import { ExternalSourceError, fetchSourceText, type SourceFetch } from '../sources/externalSource';
import { isTrackMapFile, type TrackMapMatch, toCountryCode, TRACK_MAPS_CREDIT_URL } from '../../../shared/trackRules';

/**
 * Lettura delle due fonti dei tracciati, dal server (l'app chiede l'aggiornamento e mostra l'anteprima):
 * - wiki di Gran Turismo: il testo della pagina "Gran Turismo 7/Track List" dall'API di MediaWiki (la pagina normale è
 *   protetta da Cloudflare, l'API no). Ogni tracciato è un modello {{CourseWithLayouts}} con le configurazioni
 *   {{CourseLayout}} (nome, lunghezza in metri, reversible=y);
 * - gt-engine.com, pagina delle mappe: un'immagine per configurazione (e una per il senso inverso), images/md/….png.
 * Se i siti cambiano struttura la lettura si ferma con TrackSourceError, senza toccare il database.
 */

export const WIKI_TRACK_LIST_API_URL =
  'https://gran-turismo.fandom.com/api.php?action=parse&page=Gran_Turismo_7/Track_List&prop=wikitext&format=json';

export type TrackSourceName = 'wiki' | 'maps';

/** Errore di una delle due fonti dei tracciati (vedi ExternalSourceError). */
export class TrackSourceError extends ExternalSourceError<TrackSourceName> {}

/** Una configurazione del wiki. sourceKey la ritrova negli aggiornamenti successivi ("monza|no chicane"). */
export interface WikiTrackLayout {
  readonly sourceKey: string;
  readonly name: string;
  readonly configuration: string;
  readonly country: string | null;
  readonly lengthMeters: number | null;
  readonly hasReverseLayout: boolean;
}

/** Una mappa di gt-engine; reverseFile è la mappa dello stesso tracciato nel senso inverso, se c'è. */
export interface TrackMap {
  readonly file: string;
  readonly label: string;
  readonly reverseFile: string | null;
}

const fetchText = (fetchSource: SourceFetch, url: string, source: TrackSourceName): Promise<string> =>
  fetchSourceText(
    fetchSource,
    url,
    { 'User-Agent': 'race-control-dashboard (track list)', Accept: 'application/json,text/html,*/*' },
    (reason, message) => new TrackSourceError(source, reason, message),
  );

/* ---------- Wiki ---------- */

/** Testo semplice da un valore del wiki: link [[a|b]] → b, grassetti e corsivi tolti, spazi normalizzati. */
function plainWikiText(value: string): string {
  return value
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]*>/g, '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parametri name=valore di un modello del wiki (senza modelli annidati). */
function templateParameters(body: string): Map<string, string> {
  const parameters = new Map<string, string>();
  for (const part of body.split('|')) {
    const separator = part.indexOf('=');
    if (separator > 0) parameters.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }
  return parameters;
}

export const toTrackSourceKey = (name: string, configuration: string) => `${name}|${configuration}`.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');

/** "13,629" o "13.629" → 13629; null se non è una lunghezza sensata. */
function parseLength(rawLength: string | undefined): number | null {
  const digits = (rawLength ?? '').replace(/[,.\s]/g, '');
  if (!/^\d{3,5}$/.test(digits)) return null;
  return Number(digits);
}

/** Configurazioni dal testo della pagina del wiki, nell'ordine della pagina. */
export function parseWikiTrackList(wikitext: string): WikiTrackLayout[] {
  const layouts: WikiTrackLayout[] = [];
  const seen = new Set<string>();
  const courses = wikitext.split('{{CourseWithLayouts').slice(1);
  for (const course of courses) {
    const layoutsStart = course.indexOf('|layouts=');
    const header = templateParameters(layoutsStart >= 0 ? course.slice(0, layoutsStart) : course);
    const name = plainWikiText(header.get('name') ?? '');
    if (name === '' || layoutsStart < 0) continue;
    const country = toCountryCode(plainWikiText(header.get('country') ?? ''));
    for (const match of course.slice(layoutsStart).matchAll(/\{\{CourseLayout\|([^{}]*)\}\}/g)) {
      const parameters = templateParameters(match[1] ?? '');
      const configuration = plainWikiText(parameters.get('name') ?? '');
      if (configuration === '') continue;
      const sourceKey = toTrackSourceKey(name, configuration);
      if (seen.has(sourceKey)) continue;
      seen.add(sourceKey);
      layouts.push({
        sourceKey,
        name,
        configuration,
        country,
        lengthMeters: parseLength(parameters.get('length')),
        hasReverseLayout: /^(y|yes|sì|true)$/i.test(parameters.get('reversible') ?? ''),
      });
    }
  }
  return layouts;
}

export async function fetchWikiTracks(fetchSource: SourceFetch): Promise<WikiTrackLayout[]> {
  const responseText = await fetchText(fetchSource, WIKI_TRACK_LIST_API_URL, 'wiki');
  let wikitext: unknown;
  try {
    wikitext = (JSON.parse(responseText) as { parse?: { wikitext?: { '*'?: unknown } } }).parse?.wikitext?.['*'];
  } catch {
    throw new TrackSourceError('wiki', 'changed', 'La risposta del wiki non è JSON.');
  }
  if (typeof wikitext !== 'string') throw new TrackSourceError('wiki', 'changed', 'Testo della pagina mancante.');
  const layouts = parseWikiTrackList(wikitext);
  // GT7 ha decine di tracciati: un elenco quasi vuoto vuol dire che la pagina è cambiata.
  if (layouts.length < 20) throw new TrackSourceError('wiki', 'changed', `Configurazioni trovate: ${layouts.length}.`);
  return layouts;
}

/* ---------- Mappe ---------- */

/** Le mappe della pagina: la mappa "nome-2.png" (o "nome-a2.png") è il senso inverso di "nome.png". */
export function parseTrackMaps(pageHtml: string): TrackMap[] {
  const entries: { file: string; label: string }[] = [];
  for (const match of pageHtml.matchAll(/<img\b[^>]*\bsrc="images\/md\/([^"]+)"[^>]*>/g)) {
    const file = match[1] ?? '';
    if (!isTrackMapFile(file) || entries.some((entry) => entry.file === file)) continue;
    const alt = /\balt="([^"]*)"/.exec(match[0])?.[1] ?? '';
    const label = alt.replace(/\s*track map$/i, '').trim() || file.replace(/\.png$/, '').replace(/-/g, ' ');
    entries.push({ file, label });
  }
  const files = new Set(entries.map((entry) => entry.file));
  const reverseOf = (file: string): string | null => {
    const base = file.replace(/-?2\.png$/, '.png');
    return base !== file && files.has(base) ? base : null;
  };
  return entries
    .filter((entry) => reverseOf(entry.file) === null)
    .map((entry) => ({ ...entry, reverseFile: entries.find((candidate) => reverseOf(candidate.file) === entry.file)?.file ?? null }));
}

export async function fetchTrackMaps(fetchSource: SourceFetch): Promise<TrackMap[]> {
  const maps = parseTrackMaps(await fetchText(fetchSource, TRACK_MAPS_CREDIT_URL, 'maps'));
  if (maps.length < 20) throw new TrackSourceError('maps', 'changed', `Mappe trovate: ${maps.length}.`);
  return maps;
}

/* ---------- Abbinamento per nome ---------- */

/** Parole che non distinguono un tracciato ("Circuit", "Full Course", "Layout"…). */
const STOP_WORDS = new Set(['course', 'circuit', 'layout', 'track', 'international', 'speedway', 'raceway', 'racing', 'motor', 'full', 'the', 'of', 'and']);
/** Abbreviazioni dei nomi delle mappe. */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = { gp: ['grand', 'prix'], cw: ['clockwise'], ccw: ['counterclockwise'] };

export function nameTokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .flatMap((token) => SYNONYMS[token] ?? [token])
    .filter((token) => token !== '' && !STOP_WORDS.has(token));
}

/** Una parola corta (o una lettera, "A") deve essere uguale; una lunga può essere l'inizio dell'altra ("Express" → "Expressway"). */
const tokenMatches = (token: string, candidate: string) => token === candidate || (token.length >= 4 && candidate.startsWith(token));

/** Parole del candidato in più rispetto all'elemento, se tutte le parole dell'elemento ci sono; null altrimenti. */
function extraTokens(itemTokens: readonly string[], candidateTokens: readonly string[]): number | null {
  const used = new Set<number>();
  for (const token of itemTokens) {
    const index = candidateTokens.findIndex((candidate, candidateIndex) => !used.has(candidateIndex) && tokenMatches(token, candidate));
    if (index < 0) return null;
    used.add(index);
  }
  return candidateTokens.length - used.size;
}

/**
 * Abbina per nome: un elemento va al candidato che contiene tutte le sue parole con meno parole in più. Con due
 * candidati alla pari l'elemento resta da abbinare a mano; ogni candidato va a un solo elemento (il più vicino).
 */
export function matchByName<Item, Candidate>(
  items: readonly Item[],
  candidates: readonly Candidate[],
  itemName: (item: Item) => string,
  candidateName: (candidate: Candidate) => string,
): Map<Item, Candidate> {
  const candidateTokens = candidates.map((candidate) => nameTokens(candidateName(candidate)));
  const proposals: { item: Item; candidate: Candidate; extras: number }[] = [];
  for (const item of items) {
    const tokens = nameTokens(itemName(item));
    if (tokens.length === 0) continue;
    const scored = candidates
      .map((candidate, index) => ({ candidate, extras: extraTokens(tokens, candidateTokens[index] ?? []) }))
      .filter((entry): entry is { candidate: Candidate; extras: number } => entry.extras !== null)
      .sort((first, second) => first.extras - second.extras);
    const [best, second] = scored;
    if (best && (!second || second.extras > best.extras)) proposals.push({ item, candidate: best.candidate, extras: best.extras });
  }
  const matches = new Map<Item, Candidate>();
  const taken = new Set<Candidate>();
  for (const proposal of proposals.sort((first, second) => first.extras - second.extras)) {
    if (taken.has(proposal.candidate)) continue;
    taken.add(proposal.candidate);
    matches.set(proposal.item, proposal.candidate);
  }
  return matches;
}

/** Configurazione con le sue mappe. */
export type MappedTrackLayout = WikiTrackLayout & { readonly mapFile: string | null; readonly reverseMapFile: string | null };

/**
 * Mappe delle configurazioni: abbinamenti scelti a mano (anche "nessuna"), poi per nome tra le mappe rimaste.
 * La mappa del senso inverso c'è solo per le configurazioni percorribili al contrario.
 */
export function attachTrackMaps(layouts: readonly WikiTrackLayout[], maps: readonly TrackMap[], manualMatches: readonly TrackMapMatch[]) {
  const mapByFile = new Map(maps.map((map) => [map.file, map]));
  const manualByKey = new Map(manualMatches.map((match) => [match.sourceKey, match.mapFile]));
  const manuallyUsed = new Set(manualMatches.flatMap((match) => (match.mapFile === null ? [] : [match.mapFile])));
  const automatic = matchByName(
    maps.filter((map) => !manuallyUsed.has(map.file)),
    layouts.filter((layout) => !manualByKey.has(layout.sourceKey)),
    (map) => map.label,
    (layout) => `${layout.name} ${layout.configuration}`,
  );
  const automaticByKey = new Map([...automatic].map(([map, layout]) => [layout.sourceKey, map]));

  const mapped: MappedTrackLayout[] = layouts.map((layout) => {
    const manualFile = manualByKey.get(layout.sourceKey);
    const map = manualFile === undefined ? automaticByKey.get(layout.sourceKey) : manualFile === null ? undefined : mapByFile.get(manualFile);
    return { ...layout, mapFile: map?.file ?? null, reverseMapFile: layout.hasReverseLayout ? (map?.reverseFile ?? null) : null };
  });
  const usedFiles = new Set(mapped.flatMap((layout) => (layout.mapFile ? [layout.mapFile] : [])));
  return {
    layouts: mapped,
    // Senza mappa: solo quelle non escluse a mano ("nessuna mappa").
    layoutsWithoutMap: mapped.filter((layout) => layout.mapFile === null && manualByKey.get(layout.sourceKey) !== null),
    unmatchedMaps: maps.filter((map) => !usedFiles.has(map.file)),
  };
}
