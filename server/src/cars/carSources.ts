import { ExternalSourceError, fetchSourceText, type SourceFetch } from '../sources/externalSource';
import { type BopSourceCar, type CarDrivetrain, type CarGroup, CAR_GROUPS, isCarDrivetrain, isCarGroup } from '../../../shared/carRules';

/**
 * Lettura delle due fonti delle vetture, dal server (l'app chiede l'aggiornamento e mostra l'anteprima):
 * - catalogo ufficiale di Gran Turismo 7 (gran-turismo.com/it/gt7/carlist): la pagina carica i dati con JavaScript;
 *   il file del catalogo e quello dei costruttori si trovano nel codice della pagina e si leggono come testo, senza
 *   eseguirli. Danno nome, gruppo, potenza (CV = PS), peso e trasmissione di serie;
 * - gt-engine.com, una pagina per gruppo (gr1…gr4): la tabella "Mid-spd." (id spec_table_m) dà potenza e peso con il
 *   BoP delle piste a velocità media.
 * Se i siti cambiano struttura la lettura si ferma con CarSourceError, senza toccare il database.
 */

const OFFICIAL_ORIGIN = 'https://www.gran-turismo.com';
export const OFFICIAL_CARLIST_URL = `${OFFICIAL_ORIGIN}/it/gt7/carlist`;
export const bopPageUrl = (group: CarGroup) => {
  const slug = group.replace('.', '').toLowerCase();
  return `https://gt-engine.com/gt7/cars/${slug}/${slug}-01-specs.html`;
};

export type CarSourceName = 'official' | 'bop';

/** Errore di una delle due fonti delle vetture (vedi ExternalSourceError). */
export class CarSourceError extends ExternalSourceError<CarSourceName> {}

/** Un'auto del catalogo ufficiale (solo i gruppi in CAR_GROUPS). */
export interface OfficialCar {
  readonly id: string;
  readonly group: CarGroup;
  readonly manufacturer: string;
  readonly model: string;
  readonly nameLong: string;
  readonly horsepower: number | null;
  readonly weightKg: number | null;
  readonly drivetrain: CarDrivetrain | null;
}

const fetchText = (fetchSource: SourceFetch, url: string, source: CarSourceName): Promise<string> =>
  fetchSourceText(
    fetchSource,
    url,
    { 'User-Agent': 'Mozilla/5.0 (race-control-dashboard)', Accept: 'text/html,application/javascript,*/*' },
    (reason, message) => new CarSourceError(source, reason, message),
  );

/* ---------- Catalogo ufficiale ---------- */

/** Il file JavaScript dell'elenco auto, citato nella pagina: /common/dist/gt7/carlist/assets/index-….js */
export function findOfficialAppScript(pageHtml: string): string | null {
  const match = /src="(\/common\/dist\/gt7\/carlist\/assets\/index-[\w-]+\.js)"/.exec(pageHtml);
  return match?.[1] ?? null;
}

/** Nome del modulo di un catalogo in italiano dentro lo script (es. "cars.it-BVYQdI7j.js" per name = "cars"). */
export function findCatalogModule(appScript: string, name: 'cars' | 'tuners'): string | null {
  const position = appScript.indexOf(`catalog/${name}.it.ts"`);
  if (position < 0) return null;
  return /`\.\/([\w.-]+\.js)`/.exec(appScript.slice(position, position + 300))?.[1] ?? null;
}

/** Valore di un campo di un oggetto del catalogo: `testo` oppure numero. */
function readField(body: string, field: string): string | null {
  const match = new RegExp(`(?:^|,)${field}:(\`[^\`]*\`|-?[\\d.]+)`).exec(body);
  if (!match?.[1]) return null;
  return match[1].startsWith('`') ? match[1].slice(1, -1) : match[1];
}

/** Costruttori: { tnr5: "Audi", … }. */
export function parseOfficialTuners(tunersScript: string): Map<string, string> {
  const tuners = new Map<string, string>();
  for (const match of tunersScript.matchAll(/(tnr\d+):\{id:`[^`]*`,name:`([^`]*)`\}/g)) {
    if (match[1] && match[2]) tuners.set(match[1], match[2]);
  }
  return tuners;
}

const toNumber = (text: string | null): number | null => {
  if (text === null) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
};

/**
 * Costruttore e modello dal nome completo: "Audi R8 LMS Evo '19" → Audi + "R8 LMS Evo '19". Se il costruttore
 * del catalogo è solo una parte della prima parola ("AMG" in "Mercedes-AMG GT3 '20"), il costruttore è quella parola.
 * Altrimenti costruttore del catalogo e nome breve.
 */
function splitName(nameLong: string, nameShort: string, tuner: string): { manufacturer: string; model: string } {
  const [firstWord = '', ...rest] = nameLong.split(' ');
  if (firstWord.toLowerCase() === tuner.toLowerCase() || (tuner !== '' && firstWord.toLowerCase().includes(tuner.toLowerCase()))) {
    return { manufacturer: firstWord, model: rest.join(' ').trim() || nameShort };
  }
  return { manufacturer: tuner || firstWord, model: nameShort || nameLong };
}

/** Le auto dei gruppi Gr.1–Gr.4 dal file del catalogo (oggetti `carNNN:{…}` con valori `testo` o numeri). */
export function parseOfficialCars(carsScript: string, tuners: ReadonlyMap<string, string>): OfficialCar[] {
  const cars: OfficialCar[] = [];
  for (const match of carsScript.matchAll(/(car\d+):\{([^{}]*)\}/g)) {
    const [, id, body] = match;
    if (!id || !body) continue;
    const group = readField(body, 'carClass');
    if (!isCarGroup(group)) continue;
    const nameLong = readField(body, 'nameLong') ?? '';
    const nameShort = readField(body, 'nameShort') ?? '';
    const { manufacturer, model } = splitName(nameLong, nameShort, tuners.get(readField(body, 'manufacturerId') ?? '') ?? '');
    const drivetrain = readField(body, 'driveTrain');
    cars.push({
      id,
      group,
      manufacturer,
      model,
      nameLong,
      horsepower: toNumber(readField(body, 'power_v')),
      weightKg: toNumber(readField(body, 'weight_v')),
      drivetrain: isCarDrivetrain(drivetrain) ? drivetrain : null,
    });
  }
  return cars;
}

export async function fetchOfficialCars(fetchSource: SourceFetch): Promise<OfficialCar[]> {
  const pageHtml = await fetchText(fetchSource, OFFICIAL_CARLIST_URL, 'official');
  const scriptPath = findOfficialAppScript(pageHtml);
  if (!scriptPath) throw new CarSourceError('official', 'changed', 'script dell’elenco auto non trovato nella pagina');
  const appScript = await fetchText(fetchSource, `${OFFICIAL_ORIGIN}${scriptPath}`, 'official');
  const assetsBase = `${OFFICIAL_ORIGIN}${scriptPath.slice(0, scriptPath.lastIndexOf('/') + 1)}`;
  const carsModule = findCatalogModule(appScript, 'cars');
  const tunersModule = findCatalogModule(appScript, 'tuners');
  if (!carsModule || !tunersModule) throw new CarSourceError('official', 'changed', 'file del catalogo non trovati nello script');
  const [carsScript, tunersScript] = await Promise.all([
    fetchText(fetchSource, `${assetsBase}${carsModule}`, 'official'),
    fetchText(fetchSource, `${assetsBase}${tunersModule}`, 'official'),
  ]);
  const cars = parseOfficialCars(carsScript, parseOfficialTuners(tunersScript));
  if (cars.length === 0) throw new CarSourceError('official', 'changed', 'nessuna auto Gr.1–Gr.4 nel catalogo');
  return cars;
}

/* ---------- gt-engine.com (BoP Midspeed) ---------- */

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;|&ensp;|&emsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const cellText = (cellHtml: string) => decodeEntities(cellHtml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

interface TableCell {
  readonly text: string;
  readonly span: number;
}

function readCells(rowHtml: string): TableCell[] {
  return [...rowHtml.matchAll(/<t[hd]([^>]*)>([\s\S]*?)<\/t[hd]>/g)].map((match) => ({
    text: cellText(match[2] ?? ''),
    span: Number(/colspan="?(\d+)/.exec(match[1] ?? '')?.[1] ?? '1'),
  }));
}

/** Testata senza spazi, trattini e trattini morbidi: "Manufac-turer" → "Manufacturer", "Max. Pwr.[PS]" → "Max.Pwr.[PS]". */
const headerKey = (text: string) => text.replace(/[\s­-]/g, '');

const parseThousands = (text: string): number | null => {
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
};

/**
 * Tabella "Mid-spd." di una pagina di gt-engine: la prima riga della testata dice in che colonna stanno potenza (PS),
 * peso (kg) e, nella seconda metà, costruttore e nome completo dell'auto (contando le celle unite con colspan).
 */
export function parseBopTable(pageHtml: string, group: CarGroup): BopSourceCar[] {
  const tablePosition = pageHtml.indexOf('id="spec_table_m"');
  if (tablePosition < 0) throw new CarSourceError('bop', 'changed', `tabella Mid-speed non trovata (${group})`);
  const tableHtml = pageHtml.slice(tablePosition, pageHtml.indexOf('</table>', tablePosition));
  const rows = tableHtml.split(/<tr[\s>]/).slice(1);
  const headerRow = rows.find((row) => row.includes('Manufac') && row.includes('[PS]'));
  if (!headerRow) throw new CarSourceError('bop', 'changed', `testata della tabella non riconosciuta (${group})`);

  const positions = new Map<string, number[]>();
  let column = 0;
  for (const cell of readCells(headerRow)) {
    const key = headerKey(cell.text);
    positions.set(key, [...(positions.get(key) ?? []), column]);
    column += cell.span;
  }
  // "Max. Pwr. [PS]" o "Max. Power [PS]"; con le ibride la colonna si divide in ICE e Hyb.: vale la prima (ICE),
  // come la potenza del catalogo ufficiale.
  const powerColumn = [...positions].find(([key]) => /^Max\.(Pwr\.|Power)\[PS\]$/.test(key))?.[1][0];
  const weightColumn = positions.get('Wt.[kg]')?.[0];
  const manufacturerColumn = positions.get('Manufacturer')?.[1];
  const carColumn = positions.get('Car')?.[1];
  if (powerColumn === undefined || weightColumn === undefined || manufacturerColumn === undefined || carColumn === undefined) {
    throw new CarSourceError('bop', 'changed', `colonne della tabella non riconosciute (${group})`);
  }

  const cars: BopSourceCar[] = [];
  for (const row of rows) {
    const cells = readCells(row).map((cell) => cell.text);
    if (!/^\d+$/.test(cells[0] ?? '')) continue;
    const manufacturer = cells[manufacturerColumn] ?? '';
    const model = cells[carColumn] ?? '';
    const bopHorsepower = parseThousands(cells[powerColumn] ?? '');
    const bopWeightKg = parseThousands(cells[weightColumn] ?? '');
    // La riga "(Average)" (costruttore "-") è la media del gruppo, non un'auto.
    if (!manufacturer || manufacturer === '-' || !model || bopHorsepower === null || bopWeightKg === null) continue;
    cars.push({ key: `${group}|${manufacturer}|${model}`, group, manufacturer, model, bopHorsepower, bopWeightKg });
  }
  if (cars.length === 0) throw new CarSourceError('bop', 'changed', `nessuna auto nella tabella Mid-speed (${group})`);
  return cars;
}

/** Versione del BoP più recente citata nella pagina ("Ver.1.72"). */
export function parseBopVersion(pageHtml: string): string | null {
  const versions = [...pageHtml.matchAll(/Ver\.\s*(\d+)\.(\d+)/g)].map((match) => [Number(match[1]), Number(match[2])] as const);
  if (versions.length === 0) return null;
  const [major, minor] = versions.reduce((latest, version) => (version[0] > latest[0] || (version[0] === latest[0] && version[1] > latest[1]) ? version : latest));
  return `${major}.${minor}`;
}

export async function fetchBopCars(fetchSource: SourceFetch): Promise<{ cars: BopSourceCar[]; version: string | null }> {
  const pages = await Promise.all(CAR_GROUPS.map(async (group) => ({ group, html: await fetchText(fetchSource, bopPageUrl(group), 'bop') })));
  const versions = pages.map((page) => parseBopVersion(page.html)).filter((version) => version !== null);
  return { cars: pages.flatMap((page) => parseBopTable(page.html, page.group)), version: versions[0] ?? null };
}

/* ---------- Abbinamento ---------- */

/** Nomi già resi confrontabili: l'abbinamento li confronta molte volte (CPU limitata nei Worker). */
const comparableNames = new Map<string, string>();

/** Nome confrontabile: senza accenti, maiuscole e punteggiatura; "Vision Gran Turismo" = "VGT". */
export function comparableName(name: string): string {
  const cached = comparableNames.get(name);
  if (cached !== undefined) return cached;
  const comparable = toComparableName(name);
  if (comparableNames.size > 5000) comparableNames.clear();
  comparableNames.set(name, comparable);
  return comparable;
}

const toComparableName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/vision gran turismo/g, 'vgt')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Come comparableName ma senza spazi: "Genesis X Gr.3" = "Genesis X GR3". */
export const compactName = (name: string): string => comparableName(name).replace(/ /g, '');

/**
 * Abbinamento automatico nello stesso gruppo, solo se il candidato è unico: nome completo ufficiale (o costruttore +
 * modello) = costruttore + modello di gt-engine (o il solo modello); poi modello = modello; poi il nome ufficiale
 * finisce con il modello di gt-engine ("Renault Sport R.S.01 GT3 '16" e "R.S.01 GT3 '16").
 */
export function matchBopCar(official: OfficialCar, candidates: readonly BopSourceCar[]): BopSourceCar | null {
  const sameGroup = candidates.filter((candidate) => candidate.group === official.group);
  const officialNames = new Set([comparableName(official.nameLong), comparableName(`${official.manufacturer} ${official.model}`)]);
  const byFullName = sameGroup.filter((candidate) => officialNames.has(comparableName(`${candidate.manufacturer} ${candidate.model}`)) || officialNames.has(comparableName(candidate.model)));
  if (byFullName.length === 1) return byFullName[0] ?? null;
  const officialModel = compactName(official.model);
  const byModel = sameGroup.filter((candidate) => compactName(candidate.model) === officialModel);
  if (byModel.length === 1) return byModel[0] ?? null;
  const officialName = compactName(official.nameLong);
  const bySuffix = sameGroup.filter((candidate) => officialName.endsWith(compactName(candidate.model)));
  return bySuffix.length === 1 ? (bySuffix[0] ?? null) : null;
}
