/**
 * Cambi pilota (dal foglio "Driver Swap Checker"). A ogni cambio, tra la fine di uno stint (Pit In: vettura ferma
 * in piazzola) e l'inizio del successivo (Pit Out: pit stop effettuato), ogni vettura deve ripartire con almeno
 * lo stesso distacco con cui si è fermata, meno un margine. I distacchi si misurano entrambi dalla stessa vettura di
 * riferimento, quella con il Pit In più basso (ferma per prima):
 *   distacco Pit In  = Pit In della vettura − Pit In del riferimento
 *   distacco Pit Out = Pit Out della vettura − Pit Out del riferimento (negativo se riparte davanti al riferimento)
 *   penalità se distacco Pit Out + margine < distacco Pit In: la vettura può guadagnare al massimo il margine;
 *   vale coefficiente × (distacco Pit In − distacco Pit Out − margine), arrotondata al secondo per eccesso.
 * Esempio: Pit In a +1 s, Pit Out a −10 s: con 2 s di margine poteva arrivare a −1 s; i 9 s in più × 2,5 = 22,5 → 23 s.
 * Una vettura senza uno dei due tempi (assente o ritirata) non fa da riferimento e non viene controllata.
 * Margine e coefficiente sono fissi (non modificabili dall'app). Il server ricalcola le penalità prima di salvarle.
 */

/** Margine concesso a ogni cambio: 2 secondi. */
export const DRIVER_SWAP_BUFFER_MS = 2000;
/** Coefficiente della penalità: × 2,5. */
export const DRIVER_SWAP_COEFFICIENT = 2.5;
export const DRIVER_SWAP_NOTES_MAX_LENGTH = 120;

/* Quanti cambi pilota (e quindi tabelle) ha una gara: dagli stint della sua durata (shared/championshipRules.ts, driverSwapCountOf). */

/* ---------- Tempi: sempre mostrati come HH:MM:SS.DDD ---------- */

/** Fino a 99:59:59.999. */
export const RACE_TIMESTAMP_MAX_MS = 100 * 3_600_000 - 1;
const TIMESTAMP_TEXT_MAX_LENGTH = 14;

/** Mentre si scrive restano solo cifre e separatori (":" "." ","). */
export const sanitizeTimestampInput = (rawValue: string): string =>
  rawValue.replace(/[^\d:.,]/g, '').slice(0, TIMESTAMP_TEXT_MAX_LENGTH);

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** 8 000 642 ms → "02:13:20.642". */
export function formatRaceTimestamp(milliseconds: number): string {
  // Distacco Pit Out davanti al riferimento: "-00:00:10.000".
  if (milliseconds < 0) return `-${formatRaceTimestamp(-milliseconds)}`;
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}.${pad(milliseconds % 1000, 3)}`;
}

/** Ore, minuti, secondi e millesimi già separati → millisecondi, oppure NaN se fuori dai limiti. */
function toMilliseconds(hours: string, minutes: string, seconds: string, fraction: string): number {
  if (fraction.length > 3 || Number(minutes) > 59 || Number(seconds) > 59 || hours.length > 2) return Number.NaN;
  return ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + Number(fraction.padEnd(3, '0'));
}

/**
 * Legge un tempo scritto in qualunque forma ragionevole e lo porta in millisecondi:
 *   "2:13:20,642" · "02:13:20.642" · "2.13.20,642" (come nel foglio) · "13:20.5" (minuti:secondi) ·
 *   "02.13.20.642" (HH.MM.SS.DDD) · "021320,642" o "021320.642" (HHMMSS,DDD e HHMMSS.DDD) ·
 *   cifre attaccate lette da destra: "23" = 23 s, "445" = 4:45, "021320" = 2:13:20, "021320642" (HHMMSSDDD).
 * La virgola indica sempre i millesimi; con i ":" li indica anche il punto; con soli punti, il quarto gruppo.
 * Vuoto → null; non interpretabile → NaN.
 */
export function parseRaceTimestamp(timestampText: string): number | null {
  const text = timestampText.trim();
  if (text === '') return null;
  if (!/^[\d:.,]+$/.test(text)) return Number.NaN;

  if (/^\d{9}$/.test(text)) return toMilliseconds(text.slice(0, 2), text.slice(2, 4), text.slice(4, 6), text.slice(6));
  // Cifre attaccate, lette da destra: le ultime due sono i secondi, le due prima i minuti, il resto le ore
  // ("23" = 23 s, "445" = 4:45, "13000" = 1:30:00, "021320" = 2:13:20), con i millesimi dopo la virgola
  // ("23,5", "021320,642") o dopo il punto ("021320.642"; con una o due cifre davanti il punto resta la regola
  // dei minuti.secondi, "13.20" = 13:20, se dopo ci sono due cifre).
  const compact = /^(\d{1,6})(?:([.,])(\d{1,3}))?$/.exec(text);
  const [, digits = '', separator, compactFraction = ''] = compact ?? [];
  if (compact && !(separator === '.' && digits.length <= 2 && compactFraction.length === 2)) {
    const seconds = digits.slice(-2);
    const minutes = digits.slice(-4, -2) || '0';
    const hours = digits.slice(0, -4) || '0';
    return toMilliseconds(hours, minutes, seconds, compactFraction);
  }

  let clock = text;
  let fraction = '';
  const commaIndex = text.lastIndexOf(',');
  if (commaIndex >= 0) {
    clock = text.slice(0, commaIndex);
    fraction = text.slice(commaIndex + 1);
  } else if (text.includes(':') && text.includes('.')) {
    const dotIndex = text.lastIndexOf('.');
    clock = text.slice(0, dotIndex);
    fraction = text.slice(dotIndex + 1);
  } else if (!text.includes(':') && text.split('.').length === 4) {
    const dotIndex = text.lastIndexOf('.');
    clock = text.slice(0, dotIndex);
    fraction = text.slice(dotIndex + 1);
  }
  if (!/^\d*$/.test(fraction)) return Number.NaN;

  // Il primo gruppo può avere una o due cifre, i successivi (minuti, secondi) sempre due.
  const groups = clock.split(/[:.]/);
  if (groups.some((group, index) => !(index === 0 ? /^\d{1,2}$/ : /^\d{2}$/).test(group))) return Number.NaN;
  const [first = '', second = '', third] = groups;
  if (groups.length === 3 && third !== undefined) return toMilliseconds(first, second, third, fraction);
  if (groups.length === 2) return toMilliseconds('0', first, second, fraction);
  return Number.NaN;
}

/** Testo scritto → "HH:MM:SS.DDD" se interpretabile, altrimenti invariato (e quindi segnalato come errore). */
export function normalizeTimestampText(timestampText: string): string {
  const milliseconds = parseRaceTimestamp(timestampText);
  return milliseconds === null || Number.isNaN(milliseconds) ? timestampText : formatRaceTimestamp(milliseconds);
}

/* ---------- Righe salvate con la gara ---------- */

/** Una riga di un cambio pilota: vettura, Pit In, Pit Out, annullata e note (la penalità la calcola il server). */
export interface DriverSwapEntry {
  /** 1 = cambio fra stint 1 e 2. */
  readonly swap: number;
  readonly crewId: number;
  readonly pitInMs: number | null;
  readonly pitOutMs: number | null;
  /** Penalità annullata dalla Direzione Gara (es. "Crash, penalità annullata"): resta visibile ma non conta. */
  readonly isCancelled: boolean;
  readonly notes: string;
}

export interface SavedDriverSwap extends DriverSwapEntry {
  /** Penalità calcolata (anche se annullata); null senza penalità. */
  readonly penaltyMs: number | null;
}

const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const readTimestamp = (value: unknown): number | null | undefined =>
  value === null || value === undefined
    ? null
    : typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= RACE_TIMESTAMP_MAX_MS
      ? value
      : undefined;

/** Righe dal corpo della richiesta; null se non valide o se una vettura compare due volte nello stesso cambio. */
export function readDriverSwaps(rawValue: unknown, swapCount: number): DriverSwapEntry[] | null {
  if (!Array.isArray(rawValue)) return null;
  const entries: DriverSwapEntry[] = [];
  for (const rawEntry of rawValue) {
    if (typeof rawEntry !== 'object' || rawEntry === null) return null;
    const candidate = rawEntry as Record<string, unknown>;
    const pitInMs = readTimestamp(candidate.pitInMs);
    const pitOutMs = readTimestamp(candidate.pitOutMs);
    const notes = candidate.notes === undefined ? '' : typeof candidate.notes === 'string' ? candidate.notes.trim() : null;
    const isCancelled = candidate.isCancelled === undefined ? false : candidate.isCancelled;
    if (
      !isPositiveInteger(candidate.swap) ||
      candidate.swap > swapCount ||
      !isPositiveInteger(candidate.crewId) ||
      pitInMs === undefined ||
      pitOutMs === undefined ||
      notes === null ||
      notes.length > DRIVER_SWAP_NOTES_MAX_LENGTH ||
      typeof isCancelled !== 'boolean'
    ) {
      return null;
    }
    entries.push({ swap: candidate.swap, crewId: candidate.crewId, pitInMs, pitOutMs, isCancelled, notes });
  }
  if (new Set(entries.map((entry) => `${entry.swap}:${entry.crewId}`)).size !== entries.length) return null;
  return entries.sort((first, second) => first.swap - second.swap || first.crewId - second.crewId);
}

/* ---------- Checker ---------- */

export interface DriverSwapCheck {
  readonly crewId: number;
  readonly pitInDiffMs: number | null;
  readonly pitOutDiffMs: number | null;
  readonly isPenalty: boolean;
  /** Penalità calcolata (anche se annullata); null senza penalità. */
  readonly penaltyMs: number | null;
  readonly isCancelled: boolean;
}

type CheckerRow = Pick<DriverSwapEntry, 'crewId' | 'pitInMs' | 'pitOutMs' | 'isCancelled'>;

const minimumOf = (values: readonly (number | null)[]): number | null => {
  const presentValues = values.filter((value): value is number => value !== null);
  return presentValues.length === 0 ? null : Math.min(...presentValues);
};

/** Penalità di una vettura: coefficiente × secondi guadagnati oltre il margine, arrotondata al secondo per eccesso. */
export const driverSwapPenaltyMs = (excessMs: number): number => Math.ceil((DRIVER_SWAP_COEFFICIENT * excessMs) / 1000) * 1000;

/** Un cambio pilota: righe → distacchi (dalla vettura ferma per prima), esito e penalità di ogni vettura. */
export function checkDriverSwap(rows: readonly CheckerRow[]): DriverSwapCheck[] {
  const comparableRows = rows.filter((row) => row.pitInMs !== null && row.pitOutMs !== null);
  const lowestPitIn = minimumOf(comparableRows.map((row) => row.pitInMs));
  // Riferimento: la vettura con il Pit In più basso (a parità, la prima); i due distacchi si misurano da lei.
  const reference = comparableRows.find((row) => row.pitInMs === lowestPitIn);

  return rows.map((row) => {
    const canCompare = row.pitInMs !== null && row.pitOutMs !== null && reference && reference.pitInMs !== null && reference.pitOutMs !== null;
    const pitInDiffMs = canCompare ? (row.pitInMs ?? 0) - (reference.pitInMs ?? 0) : null;
    const pitOutDiffMs = canCompare ? (row.pitOutMs ?? 0) - (reference.pitOutMs ?? 0) : null;
    const isPenalty = pitInDiffMs !== null && pitOutDiffMs !== null && pitOutDiffMs + DRIVER_SWAP_BUFFER_MS < pitInDiffMs;
    const penaltyMs =
      isPenalty && pitInDiffMs !== null && pitOutDiffMs !== null ? driverSwapPenaltyMs(pitInDiffMs - pitOutDiffMs - DRIVER_SWAP_BUFFER_MS) : null;
    return { crewId: row.crewId, pitInDiffMs, pitOutDiffMs, isPenalty, penaltyMs, isCancelled: row.isCancelled };
  });
}

/** Penalità di ogni riga, calcolata cambio per cambio (usata dal server prima di salvare). */
export function withDriverSwapPenalties(entries: readonly DriverSwapEntry[]): SavedDriverSwap[] {
  const penaltyByKey = new Map<string, number | null>();
  for (const swap of new Set(entries.map((entry) => entry.swap))) {
    for (const check of checkDriverSwap(entries.filter((entry) => entry.swap === swap))) {
      penaltyByKey.set(`${swap}:${check.crewId}`, check.penaltyMs);
    }
  }
  return entries.map((entry) => ({ ...entry, penaltyMs: penaltyByKey.get(`${entry.swap}:${entry.crewId}`) ?? null }));
}

export interface DriverSwapTotal {
  readonly crewId: number;
  readonly penaltyMs: number;
}

/** Somma per vettura delle penalità non annullate di tutti i cambi; solo le vetture con penalità, ordinate per equipaggio. */
export function totalDriverSwapPenalties(checks: readonly DriverSwapCheck[]): DriverSwapTotal[] {
  const totalByCrew = new Map<number, number>();
  for (const check of checks) {
    if (check.penaltyMs === null || check.penaltyMs <= 0 || check.isCancelled) continue;
    totalByCrew.set(check.crewId, (totalByCrew.get(check.crewId) ?? 0) + check.penaltyMs);
  }
  return [...totalByCrew].map(([crewId, penaltyMs]) => ({ crewId, penaltyMs })).sort((first, second) => first.crewId - second.crewId);
}
