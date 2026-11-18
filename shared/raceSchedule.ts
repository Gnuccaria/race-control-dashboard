/**
 * Orari delle gare: data e ora di inizio e di fine, scritti e mostrati in ora italiana (Europe/Rome) per tutti,
 * qualunque sia il fuso orario di chi usa app e sito. Le proteste per una gara si possono mandare dall'ora di inizio
 * fino a 48 ore esatte dopo l'ora di fine. Usato da app, sito e server.
 */

export const RACE_TIME_ZONE = 'Europe/Rome';
/** Le proteste restano aperte fino a 48 ore dopo la fine della gara. */
export const PROTEST_WINDOW_AFTER_END_MS = 48 * 60 * 60 * 1000;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isRaceTime = (value: unknown): value is string => typeof value === 'string' && TIME_PATTERN.test(value);

/** Orari di una gara: la data di inizio è raceDate; null nelle gare salvate prima degli orari. */
export interface RaceSchedule {
  readonly raceDate: string;
  readonly startTime: string | null;
  readonly endDate: string | null;
  readonly endTime: string | null;
}

const romeParts = new Intl.DateTimeFormat('en-US', {
  timeZone: RACE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Differenza (ms) tra l'ora italiana e l'ora UTC in quell'istante: +1 h d'inverno, +2 h d'estate. */
function romeOffsetMs(instantMs: number): number {
  const parts = Object.fromEntries(romeParts.formatToParts(new Date(instantMs)).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Istante (ms) di una data e un'ora scritte in ora italiana; null se non valide. */
export function romeLocalToInstant(isoDate: string, time: string): number | null {
  const dateMatch = ISO_DATE_PATTERN.exec(isoDate);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const asUtc = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(timeMatch[1]), Number(timeMatch[2]));
  if (Number.isNaN(asUtc)) return null;
  // Due passaggi: l'offset dipende dall'istante, che dipende dall'offset (cambio dell'ora legale).
  const firstGuess = asUtc - romeOffsetMs(asUtc);
  return asUtc - romeOffsetMs(firstGuess);
}

/** Inizio e fine della gara come istanti; null se mancano gli orari. */
export function raceInstants(schedule: RaceSchedule): { readonly startsAt: number; readonly endsAt: number } | null {
  if (!schedule.startTime || !schedule.endDate || !schedule.endTime) return null;
  const startsAt = romeLocalToInstant(schedule.raceDate, schedule.startTime);
  const endsAt = romeLocalToInstant(schedule.endDate, schedule.endTime);
  return startsAt === null || endsAt === null ? null : { startsAt, endsAt };
}

/** Finestra delle proteste: dall'inizio della gara a 48 ore dopo la fine; null senza orari. */
export function protestWindow(schedule: RaceSchedule): { readonly opensAt: number; readonly closesAt: number } | null {
  const instants = raceInstants(schedule);
  return instants ? { opensAt: instants.startsAt, closesAt: instants.endsAt + PROTEST_WINDOW_AFTER_END_MS } : null;
}

export function isProtestWindowOpen(schedule: RaceSchedule, now = Date.now()): boolean {
  const window = protestWindow(schedule);
  return window !== null && now >= window.opensAt && now <= window.closesAt;
}

/**
 * La gara è già cominciata? Le gare future non si mostrano sul sito. Senza orari (gare salvate prima) conta la data:
 * dal giorno della gara, in ora italiana.
 */
export function hasRaceStarted(schedule: RaceSchedule, now = Date.now()): boolean {
  const instants = raceInstants(schedule);
  if (instants) return now >= instants.startsAt;
  const startOfDay = romeLocalToInstant(schedule.raceDate, '00:00');
  return startOfDay === null || now >= startOfDay;
}

/** Un istante come data e ora italiane ("2026-11-18", "21:05"). */
export function instantToRomeLocal(instantMs: number): { readonly date: string; readonly time: string } {
  const parts = Object.fromEntries(romeParts.formatToParts(new Date(instantMs)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * Fine di una gara che parte a quella data e ora (italiane) e dura quelle ore: data e ora italiane della fine,
 * anche a cavallo della mezzanotte e del cambio dell'ora legale. null se data o ora non sono valide.
 */
export function raceEndAfter(raceDate: string, startTime: string, hours: number): { readonly endDate: string; readonly endTime: string } | null {
  const startsAt = romeLocalToInstant(raceDate, startTime);
  if (startsAt === null) return null;
  const end = instantToRomeLocal(startsAt + hours * 60 * 60 * 1000);
  return { endDate: end.date, endTime: end.time };
}
