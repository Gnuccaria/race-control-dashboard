/**
 * Regole di una gara e del suo ordine di arrivo, condivise tra app desktop e server
 * (come shared/crewRules.ts per gli equipaggi).
 */
import { type Championship, championshipDurations, driverSwapCountOf, findChampionship } from './championshipRules';
import type { CrewChampionship } from './crewRules';
import { isRaceTime, raceInstants } from './raceSchedule';
import type { RaceWeather } from './weatherRules';
import { type DriverSwapEntry, readDriverSwaps, type SavedDriverSwap } from './driverSwapRules';
import { type PublicQualifyingResult, type QualifyingEntry, readQualifying, type SavedQualifyingEntry } from './qualifyingRules';

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
 * Nomi di piste e configurazioni: lettere, cifre, spazi e la punteggiatura dei nomi reali
 * ("Spa-Francorchamps", "Circuit de l'Eau Rouge", "Yamagiwa + Miyabi", "Europe - Middle East").
 */
const TRACK_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .'’&()/+-]*$/u;
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
  /**
   * Penalità totali in millisecondi, come nel referto: decisioni a tempo delle penalità + cambi pilota non annullati
   * (in secondi interi, per eccesso). null senza penalità.
   */
  readonly penaltyMs: number | null;
}

/** Gara come la vede il sito pubblico: dati della gara e classifica completa. */
export interface PublicRace extends RaceSummary {
  readonly results: readonly PublicRaceResult[];
  /** Qualifiche (scheda Qualifiche del sito); assenti nelle risposte dei server non aggiornati. */
  readonly qualifying?: readonly PublicQualifyingResult[];
  /** Pattern meteo (scheda Meteo del sito), con il numero di stint della gara. */
  readonly weather: RaceWeather;
}

/** Durata di una gara in ore intere (tra le durate del suo campionato). */
export type RaceDuration = number;

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
  /** Ore, obbligatoria, tra le durate del campionato. */
  readonly duration: RaceDuration | null;
  /** Giri totali della gara (facoltativi, 1–999): nessun equipaggio può averne completati di più. */
  readonly totalLaps: number | null;
  readonly round: number;
  /** null = pista non indicata (facoltativa). */
  readonly trackId: number | null;
  /** Pista percorsa al contrario (ammesso solo se la configurazione lo prevede). */
  readonly isTrackReversed: boolean;
  /** Data di inizio, AAAA-MM-GG (anche futura: le gare si inseriscono in anticipo). */
  readonly raceDate: string;
  /** Ora di inizio, data e ora di fine, in ora italiana (shared/raceSchedule.ts): HH:MM e AAAA-MM-GG. Obbligatorie;
   * la fine dopo l'inizio. Da qui la finestra delle proteste (dall'inizio a 48 ore dopo la fine). */
  readonly startTime: string;
  readonly endDate: string;
  readonly endTime: string;
  /** Solo le posizioni occupate, in ordine di posizione. */
  readonly results: readonly RaceResultEntry[];
  /** Righe dei cambi pilota (solo quelle compilate): vettura, Pit In, Pit Out, annullata e note. */
  readonly driverSwaps: readonly DriverSwapEntry[];
  /** Qualifiche (scheda Qualifiche): miglior giro in Q1 e in Q2, facoltativi (shared/qualifyingRules.ts). */
  readonly qualifying: readonly QualifyingEntry[];
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
  /** Orari in ora italiana; null nelle gare salvate prima degli orari. */
  readonly startTime: string | null;
  readonly endDate: string | null;
  readonly endTime: string | null;
  readonly updatedAt: string;
}

/** Gara completa, con l'ordine di arrivo. */
export interface SavedRace extends RaceSummary {
  readonly results: readonly SavedRaceResult[];
  /** Qualifiche salvate, con la vettura di ogni riga; assenti nelle gare lette da un server non aggiornato. */
  readonly qualifying?: readonly SavedQualifyingEntry[];
  /** Con la penalità di ogni riga, calcolata dal server. */
  readonly driverSwaps: readonly SavedDriverSwap[];
}

export interface Track {
  readonly id: number;
  /** Nome del tracciato in inglese, come nell'elenco del wiki di Gran Turismo ("Autodromo Nazionale Monza"). */
  readonly name: string;
  /** Configurazione del tracciato ("Full Course", "No Chicane"); null = non indicata. */
  readonly configuration: string | null;
  /** Nazione (codice ISO a due lettere, es. "IT"); null = non indicata. */
  readonly country: string | null;
  readonly lengthMeters: number | null;
  /** Percorribile anche in senso inverso; null = non indicato. */
  readonly hasReverseLayout: boolean | null;
  /** Mappa di gt-engine.com (nome del file), per il briefing; null = nessuna. Vedi shared/trackRules.ts. */
  readonly mapFile: string | null;
  /** Mappa del senso inverso, se gt-engine.com ne ha una. */
  readonly reverseMapFile: string | null;
}

/** Separatore tra tracciato e configurazione ("Monza - Full Course"), uguale nel server e nell'app. */
export const TRACK_CONFIGURATION_SEPARATOR = ' - ';

/** "Monza - Full Course" o solo "Monza": come la pista compare in elenchi e menu. */
export const formatTrackName = (track: Pick<Track, 'name' | 'configuration'>): string =>
  track.configuration ? `${track.name}${TRACK_CONFIGURATION_SEPARATOR}${track.configuration}` : track.name;

/** Chiave unica di una pista: nome + configurazione, senza badare alle maiuscole (colonna name_key). */
export const toTrackKey = (track: Pick<Track, 'name' | 'configuration'>): string =>
  `${toTrackNameKey(track.name)}|${(track.configuration ?? '').toLowerCase()}`;

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
  readonly raceDate?: 'invalid';
  readonly startTime?: 'invalid';
  readonly endDate?: 'invalid';
  /** before-start = la fine non è dopo l'inizio. */
  readonly endTime?: 'invalid' | 'before-start';
  readonly results?: 'invalid' | 'repeated-crew';
  /** Qualifiche: invalid = struttura o tempi non validi; repeated-crew = equipaggio in due posizioni. */
  readonly qualifying?: 'invalid' | 'repeated-crew';
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

/** Convalida dati di origine sconosciuta e li restituisce in forma canonica. */
export function validateRaceDraft(input: unknown, championships: readonly Pick<Championship, 'name' | 'durations'>[]): RaceDraftValidation {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  // Il campionato deve esistere; si salva con il nome com'è scritto nel campionato.
  const championship = typeof candidate.championship === 'string' ? (findChampionship(championships, candidate.championship)?.name ?? null) : null;
  const name = normalizeRaceName(candidate.name);
  const isDurationMissing = candidate.duration === undefined || candidate.duration === null || candidate.duration === '';
  const duration = typeof candidate.duration === 'number' && Number.isInteger(candidate.duration) ? candidate.duration : null;
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
  // Il numero di cambi dipende dal campionato e dalla durata, cioè dagli stint (senza campionato nessuno).
  const driverSwaps = readDriverSwaps(candidate.driverSwaps ?? [], championship ? driverSwapCountOf(championships, championship, duration) : 0);

  const issues: { -readonly [Field in keyof RaceDraftIssues]: RaceDraftIssues[Field] } = {};
  if (name === undefined) issues.name = 'invalid';
  if (!championship) issues.championship = 'required';
  else if (isDurationMissing) issues.duration = 'required';
  else if (duration === null || !championshipDurations(championships, championship).some((candidateDuration) => candidateDuration.hours === duration)) {
    issues.duration = 'invalid';
  }
  if (round === null) issues.round = 'invalid';
  const isTrackReversed = candidate.isTrackReversed === true;
  if (!isTrackMissing && trackId === null) issues.trackId = 'invalid';
  else if (candidate.isTrackReversed !== undefined && typeof candidate.isTrackReversed !== 'boolean') issues.trackId = 'invalid';
  else if (isTrackReversed && trackId === null) issues.trackId = 'reverse-unavailable';
  if (!raceDate) issues.raceDate = 'invalid';
  const startTime = isRaceTime(candidate.startTime) ? candidate.startTime : null;
  const endDate = isIsoDate(candidate.endDate) ? candidate.endDate : null;
  const endTime = isRaceTime(candidate.endTime) ? candidate.endTime : null;
  if (!startTime) issues.startTime = 'invalid';
  if (!endDate) issues.endDate = 'invalid';
  if (!endTime) issues.endTime = 'invalid';
  else if (raceDate && startTime && endDate) {
    const instants = raceInstants({ raceDate, startTime, endDate, endTime });
    if (!instants || instants.endsAt <= instants.startsAt) issues.endTime = 'before-start';
  }
  if (!results) issues.results = 'invalid';
  else if (findRepeatedCrewPositions(results).size > 0) issues.results = 'repeated-crew';
  if (!driverSwaps) issues.driverSwaps = 'invalid';
  const qualifying = readQualifying(candidate.qualifying);
  if (!qualifying) issues.qualifying = 'invalid';
  else if (findRepeatedCrewPositions(qualifying).size > 0) issues.qualifying = 'repeated-crew';

  if (!isTotalLapsMissing && totalLaps === null) issues.totalLaps = 'invalid';
  else if (totalLaps !== null && results?.some((result) => result.laps > totalLaps)) issues.totalLaps = 'exceeded';
  if (
    !championship ||
    round === null ||
    !raceDate ||
    !startTime ||
    !endDate ||
    !endTime ||
    !results ||
    !driverSwaps ||
    !qualifying ||
    name === undefined ||
    Object.keys(issues).length > 0
  ) {
    return { isValid: false, issues };
  }
  return {
    isValid: true,
    race: { name, championship, duration, totalLaps, round, trackId, isTrackReversed, raceDate, startTime, endDate, endTime, results, driverSwaps, qualifying },
  };
}

/** Nome di pista in forma canonica (spazi normalizzati) o null se non valido. */
export function normalizeTrackName(rawName: unknown): string | null {
  if (typeof rawName !== 'string') return null;
  const name = rawName.normalize('NFC').trim().replace(/\s+/g, ' ');
  return name.length > 0 && [...name].length <= TRACK_NAME_MAX_LENGTH && TRACK_NAME_PATTERN.test(name) ? name : null;
}

export const toTrackNameKey = (name: string): string => name.toLowerCase();
