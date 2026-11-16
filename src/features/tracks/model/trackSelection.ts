import { TRACK_CONFIGURATION_SEPARATOR, type Track } from '@shared/raceRules';

/**
 * Scelta del tracciato in tre passi: Continente → Tracciato → Configurazione (una riga della tabella
 * tracks), più "al contrario" se la configurazione lo prevede. Funzioni pure, usate dal popup.
 */

/** Pista scelta in un form: id della configurazione e senso di marcia. */
export interface TrackChoice {
  readonly trackId: number | null;
  readonly isReversed: boolean;
}

export const NO_TRACK_CHOICE: TrackChoice = { trackId: null, isReversed: false };

/** Valore del menu Continente per le piste senza continente. */
export const NO_CONTINENT = '-';

export const continentOf = (track: Track): string => track.continent ?? NO_CONTINENT;

const textCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Continenti presenti, in ordine alfabetico; "senza continente" in fondo. */
export function listContinents(tracks: readonly Track[]): string[] {
  const continents = [...new Set(tracks.map(continentOf))];
  return continents.sort((first, second) =>
    first === NO_CONTINENT ? 1 : second === NO_CONTINENT ? -1 : textCollator.compare(first, second),
  );
}

/** Nomi dei tracciati di un continente, in ordine alfabetico e senza ripetizioni. */
export function listTrackNames(tracks: readonly Track[], continent: string): string[] {
  const names = new Map<string, string>();
  for (const track of tracks) {
    if (continentOf(track) === continent && !names.has(track.name.toLowerCase())) names.set(track.name.toLowerCase(), track.name);
  }
  return [...names.values()].sort(textCollator.compare);
}

/** Configurazioni di un tracciato (righe della tabella), nell'ordine del server. */
export const listConfigurations = (tracks: readonly Track[], continent: string, trackName: string): Track[] =>
  tracks.filter((track) => continentOf(track) === continent && track.name.toLowerCase() === trackName.toLowerCase());

/** Dizionario inglese → lingua dell'app per continenti o configurazioni. */
export type TrackTermDictionary = Readonly<Record<string, string>>;

/**
 * Traduce un nome che arriva dal server in inglese ("Full Course" → "Completo"), senza badare a
 * maiuscole e spazi. I nomi assenti dal dizionario (nomi propri come "Nordschleife") restano com'erano.
 */
export function translateTrackTerm(dictionary: TrackTermDictionary, term: string): string {
  const normalizedTerm = term.trim().toLowerCase();
  const entry = Object.entries(dictionary).find(([englishTerm]) => englishTerm.toLowerCase() === normalizedTerm);
  return entry ? entry[1] : term;
}

export interface TrackLabelTexts {
  readonly configurations: TrackTermDictionary;
  readonly reversedSuffix: string;
}

/** "Monza - Completo" e, se scelto, " al contrario": il tracciato nella lingua dell'app. */
export function formatTrackChoice(
  track: Pick<Track, 'name' | 'configuration'>,
  isReversed: boolean,
  texts: TrackLabelTexts,
): string {
  const label = track.configuration
    ? `${track.name}${TRACK_CONFIGURATION_SEPARATOR}${translateTrackTerm(texts.configurations, track.configuration)}`
    : track.name;
  return isReversed ? `${label} ${texts.reversedSuffix}` : label;
}

/** Stato dei tre menu nel popup ('' = non scelto). */
export interface TrackPickerDraft {
  readonly continent: string;
  readonly trackName: string;
  readonly trackId: number | null;
  readonly isReversed: boolean;
}

/** Riapre il popup sulla scelta attuale (se la pista esiste ancora). */
export function toPickerDraft(tracks: readonly Track[], choice: TrackChoice): TrackPickerDraft {
  const track = tracks.find((candidate) => candidate.id === choice.trackId);
  if (!track) return { continent: '', trackName: '', trackId: null, isReversed: false };
  return { continent: continentOf(track), trackName: track.name, trackId: track.id, isReversed: choice.isReversed && track.hasReverseLayout === true };
}

/** Cambiando continente si azzerano tracciato e configurazione. */
export const chooseContinent = (continent: string): TrackPickerDraft => ({ continent, trackName: '', trackId: null, isReversed: false });

/** Cambiando tracciato si azzera la configurazione; se ce n'è una sola viene scelta subito. */
export function chooseTrackName(tracks: readonly Track[], draft: TrackPickerDraft, trackName: string): TrackPickerDraft {
  const configurations = listConfigurations(tracks, draft.continent, trackName);
  return { ...draft, trackName, trackId: configurations.length === 1 ? (configurations[0]?.id ?? null) : null, isReversed: false };
}

export const chooseConfiguration = (draft: TrackPickerDraft, trackId: number): TrackPickerDraft => ({ ...draft, trackId, isReversed: false });

/** La configurazione scelta si può percorrere al contrario? */
export const canReverse = (track: Track | undefined): boolean => track?.hasReverseLayout === true;
