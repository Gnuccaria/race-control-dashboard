/**
 * Regole di una gara e del suo ordine di arrivo, condivise tra app desktop e server
 * (come shared/crewRules.ts per gli equipaggi).
 */
import { type CrewChampionship, isCrewChampionship } from './crewRules';
import { type DriverSwapEntry, driverSwapCount, readDriverSwaps, type SavedDriverSwap } from './driverSwapRules';

/** Righe dell'ordine di arrivo. */
export const RACE_RESULT_POSITIONS = 14;
export const RACE_ROUND_MIN = 1;
export const RACE_ROUND_MAX = 99;
const RACE_ROUND_MAX_DIGITS = String(RACE_ROUND_MAX).length;
export const TRACK_NAME_MAX_LENGTH = 64;
export const RACE_LAPS_MAX = 999;
const RACE_LAPS_MAX_DIGITS = String(RACE_LAPS_MAX).length;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NON_DIGIT_PATTERN = /\D/g;
/**
 * Nomi di piste, configurazioni e continenti: lettere, cifre, spazi e la punteggiatura dei nomi reali
 * ("Spa-Francorchamps", "Circuit de l'Eau Rouge", "Yamagiwa + Miyabi", "Europe - Middle East").
 */
const TRACK_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .'’&()/+-]*$/u;
export const TRACK_CONTINENT_MAX_LENGTH = 48;
export const TRACK_LENGTH_MAX_METERS = 99999;

export interface RaceResultEntry {
  /** 1 = vincitore. */
  readonly position: number;
  readonly crewId: number;
  /** Giri completati (0–999). */
  readonly laps: number;
  /** Distacco dal leader in millisecondi (facoltativo, vedi parseGapText). */
  readonly gapMs: number | null;
}

/** Riga salvata: i giri possono mancare nelle classifiche salvate prima che il campo esistesse. */
export interface SavedRaceResult extends Omit<RaceResultEntry, 'laps'> {
  readonly laps: number | null;
  /** Vettura usata in quella gara, fissata al salvataggio (null nelle righe salvate senza auto). */
  readonly carId: number | null;
}

/** Riga della classifica pubblica (sito dei risultati): equipaggio e vettura già risolti dal server. */
export interface PublicRaceResult {
  readonly position: number;
  readonly laps: number | null;
  readonly crewNumber: number;
  readonly crewName: string;
  readonly crewColor: string | null;
  /** Vettura usata in quella gara ("Porsche 911 GT3 R"), null se non registrata. */
  readonly carName: string | null;
  /** Distacco dal leader in millisecondi, null se non indicato. */
  readonly gapMs: number | null;
}

/** Gara come la vede il sito pubblico: dati della gara e classifica completa. */
export interface PublicRace extends RaceSummary {
  readonly results: readonly PublicRaceResult[];
}

/** Durate di gara, salvate in inglese. */
export const RACE_DURATIONS = ['3 hours', '6 hours', '12 hours'] as const;
export type RaceDuration = (typeof RACE_DURATIONS)[number];
/** Durate possibili in ogni campionato; la durata è sempre obbligatoria. */
export const RACE_DURATIONS_BY_CHAMPIONSHIP: Readonly<Record<CrewChampionship, readonly RaceDuration[]>> = {
  'Cool1 FIE Championship': ['6 hours', '12 hours'],
  'All Japan GT Championship': ['3 hours'],
};
/** Durate del campionato (nessuna per un campionato sconosciuto). */
export const raceDurationsFor = (championship: string): readonly RaceDuration[] =>
  isCrewChampionship(championship) ? RACE_DURATIONS_BY_CHAMPIONSHIP[championship] : [];
/** La durata che si può dare per scontata: l'unica del campionato (es. 3 ore nell'All Japan GT Championship). */
export const onlyRaceDurationFor = (championship: string): RaceDuration | null => {
  const durations = raceDurationsFor(championship);
  return durations.length === 1 ? (durations[0] ?? null) : null;
};
export const isRaceDuration = (value: unknown): value is RaceDuration => RACE_DURATIONS.some((duration) => duration === value);

/** Nome della gara (facoltativo): lettere, cifre, spazi e la punteggiatura dei titoli ("6 Ore di Monza – Round 3"). */
export const RACE_NAME_MAX_LENGTH = 80;
const RACE_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,:;'’&()/+#!?°–-]*$/u;

/** Nome normalizzato; null se vuoto; undefined se non valido. */
export function normalizeRaceName(rawName: unknown): string | null | undefined {
  if (rawName === undefined || rawName === null) return null;
  if (typeof rawName !== 'string') return undefined;
  const name = rawName.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (name === '') return null;
  return [...name].length <= RACE_NAME_MAX_LENGTH && RACE_NAME_PATTERN.test(name) ? name : undefined;
}

/**
 * Vettura da salvare in ogni riga dell'ordine di arrivo. Una riga rimasta uguale (stessa posizione,
 * stesso equipaggio) tiene la vettura già salvata, anche se nel frattempo l'equipaggio ha cambiato auto;
 * una riga nuova o cambiata prende l'auto attuale dell'equipaggio. Le righe che dovrebbero prendere
 * l'auto attuale ma l'equipaggio non ne ha una finiscono in positionsWithoutCar.
 */
export function resolveResultCars(
  results: readonly Pick<RaceResultEntry, 'position' | 'crewId'>[],
  savedResults: readonly Pick<SavedRaceResult, 'position' | 'crewId' | 'carId'>[],
  currentCarIdByCrewId: ReadonlyMap<number, number | null>,
): { readonly carIdByPosition: ReadonlyMap<number, number | null>; readonly positionsWithoutCar: readonly number[] } {
  const carIdByPosition = new Map<number, number | null>();
  const positionsWithoutCar: number[] = [];
  for (const { position, crewId } of results) {
    const unchangedRow = savedResults.find((saved) => saved.position === position && saved.crewId === crewId);
    if (unchangedRow) {
      carIdByPosition.set(position, unchangedRow.carId);
      continue;
    }
    const currentCarId = currentCarIdByCrewId.get(crewId) ?? null;
    if (currentCarId === null) positionsWithoutCar.push(position);
    carIdByPosition.set(position, currentCarId);
  }
  return { carIdByPosition, positionsWithoutCar };
}

export interface RaceDraft {
  /** Nome della gara (facoltativo). */
  readonly name: string | null;
  readonly championship: CrewChampionship;
  /** Obbligatoria, tra quelle del campionato (RACE_DURATIONS_BY_CHAMPIONSHIP). */
  readonly duration: RaceDuration | null;
  /** Giri totali della gara (facoltativi, 1–999): nessun equipaggio può averne completati di più. */
  readonly totalLaps: number | null;
  readonly round: number;
  /** null = pista non indicata (facoltativa). */
  readonly trackId: number | null;
  /** Pista percorsa al contrario (ammesso solo se la configurazione lo prevede). */
  readonly isTrackReversed: boolean;
  /** AAAA-MM-GG */
  readonly raceDate: string;
  /** Solo le posizioni occupate, in ordine di posizione. */
  readonly results: readonly RaceResultEntry[];
  /** Righe dei cambi pilota (solo quelle compilate): vettura, Pit In, Pit Out, annullata e note. */
  readonly driverSwaps: readonly DriverSwapEntry[];
}

/** Riga dell'elenco gare. */
export interface RaceSummary {
  readonly id: number;
  readonly name: string | null;
  readonly championship: CrewChampionship;
  readonly duration: RaceDuration | null;
  readonly totalLaps: number | null;
  readonly round: number;
  readonly trackId: number | null;
  /** Nome del tracciato e configurazione, in inglese come nella tabella tracks: l'app li traduce e compone. */
  readonly trackName: string | null;
  readonly trackConfiguration: string | null;
  readonly isTrackReversed: boolean;
  readonly raceDate: string;
  readonly updatedAt: string;
}

/** Gara completa, con l'ordine di arrivo. */
export interface SavedRace extends RaceSummary {
  readonly results: readonly SavedRaceResult[];
  /** Con la penalità di ogni riga, calcolata dal server. */
  readonly driverSwaps: readonly SavedDriverSwap[];
}

export interface Track {
  readonly id: number;
  readonly name: string;
  /** Configurazione del tracciato ("Full Course", "No Chicane"); null = non indicata. */
  readonly configuration: string | null;
  readonly continent: string | null;
  readonly lengthMeters: number | null;
  /** Percorribile anche in senso inverso; null = non indicato. */
  readonly hasReverseLayout: boolean | null;
}

/** Dati di una pista da salvare (senza id). */
export type TrackDraft = Omit<Track, 'id'>;

/** Separatore tra tracciato e configurazione ("Monza - Full Course"), uguale nel server e nell'app. */
export const TRACK_CONFIGURATION_SEPARATOR = ' - ';

/** "Monza - Full Course" o solo "Monza": come la pista compare in elenchi e menu. */
export const formatTrackName = (track: Pick<Track, 'name' | 'configuration'>): string =>
  track.configuration ? `${track.name}${TRACK_CONFIGURATION_SEPARATOR}${track.configuration}` : track.name;

/** Chiave unica di una pista: nome + configurazione, senza badare alle maiuscole (colonna name_key). */
export const toTrackKey = (track: Pick<Track, 'name' | 'configuration'>): string =>
  `${toTrackNameKey(track.name)}|${(track.configuration ?? '').toLowerCase()}`;

export interface TrackDraftIssues {
  readonly name?: 'invalid';
  readonly configuration?: 'invalid';
  readonly continent?: 'invalid';
  readonly lengthMeters?: 'invalid';
  readonly hasReverseLayout?: 'invalid';
}

export type TrackDraftValidation =
  | { readonly isValid: true; readonly track: TrackDraft }
  | { readonly isValid: false; readonly issues: TrackDraftIssues };

/** Testo facoltativo: vuoto → null, altrimenti normalizzato e controllato come i nomi. */
function readOptionalTrackText(rawValue: unknown, maxLength: number): string | null | undefined {
  if (rawValue === undefined || rawValue === null || (typeof rawValue === 'string' && rawValue.trim() === '')) return null;
  if (typeof rawValue !== 'string') return undefined;
  const text = rawValue.normalize('NFC').trim().replace(/\s+/g, ' ');
  return [...text].length <= maxLength && TRACK_NAME_PATTERN.test(text) ? text : undefined;
}

/** Convalida una pista con tutti i suoi dati (solo il nome è obbligatorio). */
export function validateTrackDraft(input: unknown): TrackDraftValidation {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const name = normalizeTrackName(candidate.name);
  const configuration = readOptionalTrackText(candidate.configuration, TRACK_NAME_MAX_LENGTH);
  const continent = readOptionalTrackText(candidate.continent, TRACK_CONTINENT_MAX_LENGTH);
  const { lengthMeters, hasReverseLayout } = candidate;
  const isLengthValid =
    lengthMeters === undefined ||
    lengthMeters === null ||
    (typeof lengthMeters === 'number' && Number.isInteger(lengthMeters) && lengthMeters > 0 && lengthMeters <= TRACK_LENGTH_MAX_METERS);
  const isReverseValid = hasReverseLayout === undefined || hasReverseLayout === null || typeof hasReverseLayout === 'boolean';

  const issues: { -readonly [Field in keyof TrackDraftIssues]: TrackDraftIssues[Field] } = {};
  if (name === null) issues.name = 'invalid';
  if (configuration === undefined) issues.configuration = 'invalid';
  if (continent === undefined) issues.continent = 'invalid';
  if (!isLengthValid) issues.lengthMeters = 'invalid';
  if (!isReverseValid) issues.hasReverseLayout = 'invalid';
  if (name === null || configuration === undefined || continent === undefined || Object.keys(issues).length > 0) {
    return { isValid: false, issues };
  }
  return {
    isValid: true,
    track: {
      name,
      configuration,
      continent,
      lengthMeters: (lengthMeters as number | null | undefined) ?? null,
      hasReverseLayout: (hasReverseLayout as boolean | null | undefined) ?? null,
    },
  };
}

/** Tiene solo le cifre e al massimo due: nel campo Round non si può scrivere altro. */
export function sanitizeRoundInput(rawValue: string): string {
  return rawValue.replace(NON_DIGIT_PATTERN, '').slice(0, RACE_ROUND_MAX_DIGITS);
}

/** "1"…"99" → numero; vuoto, 0 o non valido → null. */
export function parseRound(roundText: string): number | null {
  if (!/^\d{1,2}$/.test(roundText)) return null;
  const round = Number(roundText);
  return round >= RACE_ROUND_MIN && round <= RACE_ROUND_MAX ? round : null;
}

/** Tiene solo le cifre e al massimo tre: nel campo Giri completati non si può scrivere altro. */
/** Distacco massimo: 999:59,999 (in millisecondi). */
export const RACE_GAP_MAX_MS = 999 * 60_000 + 59_999;
const GAP_TEXT_MAX_LENGTH = 10;
/** "1:05,320", "1:05", "65,3", "65" (minuti facoltativi; con i minuti, i secondi sono due cifre da 00 a 59). */
const GAP_TEXT_PATTERN = /^(?:(\d{1,3}):([0-5]\d)|(\d{1,4}))(?:[.,](\d{1,3}))?$/;

/** Mentre si scrive il distacco restano solo cifre, ":" e il separatore dei decimali. */
export function sanitizeGapInput(rawValue: string): string {
  return rawValue.replace(/[^\d:.,]/g, '').slice(0, GAP_TEXT_MAX_LENGTH);
}

/**
 * Distacco scritto come minuti:secondi,millesimi → millisecondi. Vuoto → null (nessun distacco);
 * scritto male o oltre 999:59,999 → NaN, che la convalida rifiuta. I decimali mancanti valgono zero
 * ("1:05,3" = 1:05,300).
 */
export function parseGapText(gapText: string): number | null {
  const text = gapText.trim();
  if (text === '') return null;
  const match = GAP_TEXT_PATTERN.exec(text);
  if (!match) return Number.NaN;
  const [, minutesText, secondsWithMinutes, secondsOnly, fractionText = ''] = match;
  const milliseconds = Number(minutesText ?? 0) * 60_000 + Number(secondsWithMinutes ?? secondsOnly) * 1000 + Number(fractionText.padEnd(3, '0'));
  return milliseconds <= RACE_GAP_MAX_MS ? milliseconds : Number.NaN;
}

/** Millisecondi → "1:05,320" (o "12,345" sotto il minuto), con il separatore dei decimali della lingua. */
export function formatGap(milliseconds: number, decimalSeparator: string): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const fraction = String(milliseconds % 1000).padStart(3, '0');
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}${decimalSeparator}${fraction}` : `${seconds}${decimalSeparator}${fraction}`;
}

export function sanitizeLapsInput(rawValue: string): string {
  return rawValue.replace(NON_DIGIT_PATTERN, '').slice(0, RACE_LAPS_MAX_DIGITS);
}

/** "0"…"999" → numero; vuoto → null. */
export function parseLaps(lapsText: string): number | null {
  return /^\d{1,3}$/.test(lapsText) ? Number(lapsText) : null;
}

/** Data reale in formato AAAA-MM-GG (rifiuta per esempio il 31 febbraio). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

/**
 * Data di oggi (AAAA-MM-GG) nel fuso orario indicato; senza fuso, quello del computer.
 * "en-CA" scrive già le date nel formato ISO.
 */
export function todayIsoDate(now: Date = new Date(), timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * Posizioni che ripetono un equipaggio già inserito più in alto in classifica:
 * posizione ripetuta → posizione della prima occorrenza. La prima occorrenza non è un errore.
 */
export function findRepeatedCrewPositions(results: readonly Pick<RaceResultEntry, 'position' | 'crewId'>[]): Map<number, number> {
  const firstPositionByCrewId = new Map<number, number>();
  const repeatedPositions = new Map<number, number>();
  for (const { position, crewId } of [...results].sort((first, second) => first.position - second.position)) {
    const firstPosition = firstPositionByCrewId.get(crewId);
    if (firstPosition === undefined) firstPositionByCrewId.set(crewId, position);
    else repeatedPositions.set(position, firstPosition);
  }
  return repeatedPositions;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export interface RaceDraftIssues {
  readonly name?: 'invalid';
  readonly championship?: 'required';
  /** required = manca in un campionato che la prevede; invalid = valore sconosciuto o indicato dove non serve. */
  readonly duration?: 'required' | 'invalid';
  /** invalid = non è un intero da 1 a 999; exceeded = qualche equipaggio ha completato più giri. */
  readonly totalLaps?: 'invalid' | 'exceeded';
  readonly round?: 'invalid';
  /** reverse-unavailable = al contrario senza pista (il server lo usa anche per le piste che non lo prevedono). */
  readonly trackId?: 'invalid' | 'reverse-unavailable';
  /** future = dopo la data di oggi: una gara si registra solo dopo che si è corsa. */
  readonly raceDate?: 'invalid' | 'future';
  readonly results?: 'invalid' | 'repeated-crew';
  readonly driverSwaps?: 'invalid';
}

export type RaceDraftValidation =
  | { readonly isValid: true; readonly race: RaceDraft }
  | { readonly isValid: false; readonly issues: RaceDraftIssues };

/** Il primo classificato non ha distacco: è il riferimento degli altri. */
export const LEADER_POSITION = 1;
export const canPositionHaveGap = (position: number): boolean => position !== LEADER_POSITION;

function readResults(rawResults: unknown): RaceResultEntry[] | null {
  if (!Array.isArray(rawResults) || rawResults.length > RACE_RESULT_POSITIONS) return null;
  const results: RaceResultEntry[] = [];
  const usedPositions = new Set<number>();
  for (const rawEntry of rawResults as unknown[]) {
    const { position, crewId, laps, gapMs } = (rawEntry ?? {}) as Partial<Record<'position' | 'crewId' | 'laps' | 'gapMs', unknown>>;
    if (!isPositiveInteger(position) || position > RACE_RESULT_POSITIONS || usedPositions.has(position)) return null;
    if (!isPositiveInteger(crewId)) return null;
    if (typeof laps !== 'number' || !Number.isInteger(laps) || laps < 0 || laps > RACE_LAPS_MAX) return null;
    const isGapMissing = gapMs === undefined || gapMs === null;
    if (!isGapMissing && (typeof gapMs !== 'number' || !Number.isInteger(gapMs) || gapMs < 0 || gapMs > RACE_GAP_MAX_MS)) return null;
    if (!isGapMissing && !canPositionHaveGap(position)) return null;
    usedPositions.add(position);
    results.push({ position, crewId, laps, gapMs: isGapMissing ? null : gapMs });
  }
  return results.sort((first, second) => first.position - second.position);
}

export interface RaceDraftValidationOptions {
  /** Ultima data ammessa (AAAA-MM-GG), cioè "oggi": le date successive sono rifiutate. */
  readonly latestRaceDate?: string;
}

/** Convalida dati di origine sconosciuta e li restituisce in forma canonica. */
export function validateRaceDraft(input: unknown, options: RaceDraftValidationOptions = {}): RaceDraftValidation {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  const championship = isCrewChampionship(candidate.championship) ? candidate.championship : null;
  const name = normalizeRaceName(candidate.name);
  const isDurationMissing = candidate.duration === undefined || candidate.duration === null || candidate.duration === '';
  const duration = isRaceDuration(candidate.duration) ? candidate.duration : null;
  const isTotalLapsMissing = candidate.totalLaps === undefined || candidate.totalLaps === null;
  const totalLaps =
    typeof candidate.totalLaps === 'number' && Number.isInteger(candidate.totalLaps) && candidate.totalLaps >= 1 && candidate.totalLaps <= RACE_LAPS_MAX
      ? candidate.totalLaps
      : null;
  const round =
    typeof candidate.round === 'number' &&
    Number.isInteger(candidate.round) &&
    candidate.round >= RACE_ROUND_MIN &&
    candidate.round <= RACE_ROUND_MAX
      ? candidate.round
      : null;
  const isTrackMissing = candidate.trackId === undefined || candidate.trackId === null;
  const trackId = isPositiveInteger(candidate.trackId) ? candidate.trackId : null;
  const raceDate = isIsoDate(candidate.raceDate) ? candidate.raceDate : null;
  const results = readResults(candidate.results ?? []);
  // Il numero di cambi dipende dal campionato (senza campionato nessuno).
  const driverSwaps = readDriverSwaps(candidate.driverSwaps ?? [], championship ? driverSwapCount(championship) : 0);

  const issues: { -readonly [Field in keyof RaceDraftIssues]: RaceDraftIssues[Field] } = {};
  if (name === undefined) issues.name = 'invalid';
  if (!championship) issues.championship = 'required';
  else if (isDurationMissing) issues.duration = 'required';
  else if (duration === null || !raceDurationsFor(championship).includes(duration)) issues.duration = 'invalid';
  if (round === null) issues.round = 'invalid';
  const isTrackReversed = candidate.isTrackReversed === true;
  if (!isTrackMissing && trackId === null) issues.trackId = 'invalid';
  else if (candidate.isTrackReversed !== undefined && typeof candidate.isTrackReversed !== 'boolean') issues.trackId = 'invalid';
  else if (isTrackReversed && trackId === null) issues.trackId = 'reverse-unavailable';
  if (!raceDate) issues.raceDate = 'invalid';
  // Le date AAAA-MM-GG si confrontano correttamente anche come testo.
  else if (options.latestRaceDate !== undefined && raceDate > options.latestRaceDate) issues.raceDate = 'future';
  if (!results) issues.results = 'invalid';
  else if (findRepeatedCrewPositions(results).size > 0) issues.results = 'repeated-crew';
  if (!driverSwaps) issues.driverSwaps = 'invalid';

  if (!isTotalLapsMissing && totalLaps === null) issues.totalLaps = 'invalid';
  else if (totalLaps !== null && results?.some((result) => result.laps > totalLaps)) issues.totalLaps = 'exceeded';
  if (!championship || round === null || !raceDate || !results || !driverSwaps || name === undefined || Object.keys(issues).length > 0) {
    return { isValid: false, issues };
  }
  return {
    isValid: true,
    race: { name, championship, duration, totalLaps, round, trackId, isTrackReversed, raceDate, results, driverSwaps },
  };
}

/** Nome di pista in forma canonica (spazi normalizzati) o null se non valido. */
export function normalizeTrackName(rawName: unknown): string | null {
  if (typeof rawName !== 'string') return null;
  const name = rawName.normalize('NFC').trim().replace(/\s+/g, ' ');
  return name.length > 0 && [...name].length <= TRACK_NAME_MAX_LENGTH && TRACK_NAME_PATTERN.test(name) ? name : null;
}

export const toTrackNameKey = (name: string): string => name.toLowerCase();
