import { TRACK_CONFIGURATION_SEPARATOR, type Track } from '@shared/raceRules';

/**
 * Scelta del tracciato in tre passi: Nazione → Tracciato → Configurazione (una riga della tabella
 * tracks), più "al contrario" se la configurazione lo prevede. Funzioni pure, usate dal popup.
 */

/** Pista scelta in un form: id della configurazione e senso di marcia. */
export interface TrackChoice {
  readonly trackId: number | null;
  readonly isReversed: boolean;
}

export const NO_TRACK_CHOICE: TrackChoice = { trackId: null, isReversed: false };

/** Valore del menu Nazione per i tracciati senza nazione. */
export const NO_COUNTRY = '-';

export const countryOf = (track: Track): string => track.country ?? NO_COUNTRY;

const textCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Nazioni presenti (codici), in ordine alfabetico del nome nella lingua dell'app; "senza nazione" in fondo. */
export function listCountries(tracks: readonly Track[], countryLabel: (country: string) => string = (country) => country): string[] {
  const countries = [...new Set(tracks.map(countryOf))];
  return countries.sort((first, second) =>
    first === NO_COUNTRY ? 1 : second === NO_COUNTRY ? -1 : textCollator.compare(countryLabel(first), countryLabel(second)),
  );
}

/** Nomi dei tracciati di una nazione, in ordine alfabetico e senza ripetizioni. */
export function listTrackNames(tracks: readonly Track[], country: string): string[] {
  const names = new Map<string, string>();
  for (const track of tracks) {
    if (countryOf(track) === country && !names.has(track.name.toLowerCase())) names.set(track.name.toLowerCase(), track.name);
  }
  return [...names.values()].sort(textCollator.compare);
}

/** Configurazioni di un tracciato (righe della tabella), nell'ordine del server. */
export const listConfigurations = (tracks: readonly Track[], country: string, trackName: string): Track[] =>
  tracks.filter((track) => countryOf(track) === country && track.name.toLowerCase() === trackName.toLowerCase());

/** Dizionario inglese → lingua dell'app per le configurazioni. */
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
  readonly country: string;
  readonly trackName: string;
  readonly trackId: number | null;
  readonly isReversed: boolean;
}

/** Riapre il popup sulla scelta attuale (se la pista esiste ancora). */
export function toPickerDraft(tracks: readonly Track[], choice: TrackChoice): TrackPickerDraft {
  const track = tracks.find((candidate) => candidate.id === choice.trackId);
  if (!track) return { country: '', trackName: '', trackId: null, isReversed: false };
  return { country: countryOf(track), trackName: track.name, trackId: track.id, isReversed: choice.isReversed && track.hasReverseLayout === true };
}

/** Cambiando nazione si azzerano tracciato e configurazione. */
export const chooseCountry = (country: string): TrackPickerDraft => ({ country, trackName: '', trackId: null, isReversed: false });

/** Cambiando tracciato si azzera la configurazione; se ce n'è una sola viene scelta subito. */
export function chooseTrackName(tracks: readonly Track[], draft: TrackPickerDraft, trackName: string): TrackPickerDraft {
  const configurations = listConfigurations(tracks, draft.country, trackName);
  return { ...draft, trackName, trackId: configurations.length === 1 ? (configurations[0]?.id ?? null) : null, isReversed: false };
}

export const chooseConfiguration = (draft: TrackPickerDraft, trackId: number): TrackPickerDraft => ({ ...draft, trackId, isReversed: false });

/** La configurazione scelta si può percorrere al contrario? */
export const canReverse = (track: Track | undefined): boolean => track?.hasReverseLayout === true;
