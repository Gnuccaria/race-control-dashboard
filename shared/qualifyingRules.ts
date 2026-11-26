/**
 * Qualifiche di una gara (scheda "Qualifiche" del dettaglio gara nell'app e del sito), condivise tra app e server.
 * Stessa struttura dell'ordine di arrivo: 14 posizioni, ognuna con un equipaggio del campionato; al posto di giri e
 * distacco, il miglior giro in Q1 e in Q2, facoltativi. Il tempo Q2 c'è solo nelle posizioni 1–4 e 8–11.
 */
import { parseGapText, sanitizeGapInput } from './raceRules';
import { fieldsOf, isPositiveInteger } from './valueRules';

export const QUALIFYING_POSITIONS = 14;

/** Posizioni con il tempo Q2: 1–4 e 8–11. */
export const canPositionHaveQ2 = (position: number): boolean => (position >= 1 && position <= 4) || (position >= 8 && position <= 11);

/** Miglior giro massimo: 59:59.999. */
export const QUALIFYING_LAP_MAX_MS = 59 * 60_000 + 59_999;

export interface QualifyingEntry {
  readonly position: number;
  readonly crewId: number;
  /** Miglior giro in Q1, in millisecondi; null se non indicato. */
  readonly q1Ms: number | null;
  /** Miglior giro in Q2 (solo posizioni 1–4 e 8–11); null se non indicato. */
  readonly q2Ms: number | null;
}

/** Riga salvata: con la vettura dell'equipaggio in quelle qualifiche (come per l'ordine di arrivo). */
export interface SavedQualifyingEntry extends QualifyingEntry {
  readonly carId: number | null;
}

/** Riga delle qualifiche sul sito pubblico. */
export interface PublicQualifyingResult {
  readonly position: number;
  readonly crewNumber: number;
  readonly crewName: string;
  readonly crewColor: string | null;
  readonly carName: string | null;
  readonly q1Ms: number | null;
  readonly q2Ms: number | null;
}

/** Nella casella del tempo si scrivono solo cifre, ":" e il separatore dei decimali (punto o virgola). */
export const sanitizeLapTimeInput = (rawValue: string): string => sanitizeGapInput(rawValue);

/** "1:58.432", "1:58,432", "58.4" → millisecondi; vuoto → null; scritto male o oltre 59:59.999 → NaN. */
export function parseLapTimeText(text: string): number | null {
  const milliseconds = parseGapText(text);
  if (milliseconds === null || Number.isNaN(milliseconds)) return milliseconds;
  return milliseconds > 0 && milliseconds <= QUALIFYING_LAP_MAX_MS ? milliseconds : Number.NaN;
}

/** Millisecondi → "M:SS.DDD" (sempre con i minuti e il punto: "0:58.432", "1:58.432"). */
export function formatLapTime(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds % 1000).padStart(3, '0')}`;
}

const isLapTime = (value: unknown): value is number => isPositiveInteger(value) && value <= QUALIFYING_LAP_MAX_MS;

/**
 * Qualifiche di origine sconosciuta in forma canonica (per posizione); assenti = nessuna. null se non valide: posizione
 * fuori da 1–14 o ripetuta, equipaggio non valido, tempo non valido, Q2 in una posizione che non lo prevede.
 */
export function readQualifying(rawValue: unknown): QualifyingEntry[] | null {
  if (rawValue === undefined || rawValue === null) return [];
  if (!Array.isArray(rawValue) || rawValue.length > QUALIFYING_POSITIONS) return null;
  const entries: QualifyingEntry[] = [];
  for (const rawEntry of rawValue as unknown[]) {
    const { position, crewId, q1Ms, q2Ms } = fieldsOf(rawEntry);
    if (!isPositiveInteger(position) || position > QUALIFYING_POSITIONS || entries.some((entry) => entry.position === position)) return null;
    if (!isPositiveInteger(crewId)) return null;
    const q1 = q1Ms === undefined || q1Ms === null ? null : isLapTime(q1Ms) ? q1Ms : undefined;
    const q2 = q2Ms === undefined || q2Ms === null ? null : isLapTime(q2Ms) && canPositionHaveQ2(position) ? q2Ms : undefined;
    if (q1 === undefined || q2 === undefined) return null;
    entries.push({ position, crewId, q1Ms: q1, q2Ms: q2 });
  }
  return entries.sort((first, second) => first.position - second.position);
}
