/**
 * Orari delle qualifiche e finestre delle proteste, scelti per ogni campionato (scheda Generale) e condivisi tra app,
 * sito e server:
 * - le qualifiche cominciano un certo anticipo prima della gara (da 1 ora a 7 giorni) e durano un certo tempo;
 * - le proteste di qualifica si mandano dall'inizio delle qualifiche fino alla finestra scelta dopo la loro fine
 *   (da 1 ora a 1 giorno); quelle di gara dall'inizio della gara fino alla finestra scelta dopo la fine (da 6 ore a 7
 *   giorni);
 * - le due finestre non si sovrappongono (la finestra delle qualifiche si chiude al più tardi quando parte la gara),
 *   così dall'orario di invio si sa se una protesta riguarda le qualifiche o la gara.
 * I valori si scelgono da menu con valori fissi.
 */
import { raceInstants, type RaceSchedule } from './raceSchedule';

/** Anticipo delle qualifiche sull'inizio della gara, in ore: 1, 2, 3, 6, 12 ore, 1, 2, 3, 5, 7 giorni. */
export const QUALIFYING_ADVANCE_HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 120, 168] as const;
/** Durata delle qualifiche, in minuti. */
export const QUALIFYING_DURATION_MINUTES = [10, 15, 20, 30, 45, 60, 90, 120] as const;
/** Finestra delle proteste dopo la fine delle qualifiche, in ore: 1, 2, 3, 6, 12 ore, 1 giorno. */
export const QUALIFYING_PROTEST_HOURS = [1, 2, 3, 6, 12, 24] as const;
/** Finestra delle proteste dopo la fine della gara, in ore: 6, 12 ore, 1, 2, 3, 5, 7 giorni. */
export const RACE_PROTEST_HOURS = [6, 12, 24, 48, 72, 120, 168] as const;

export interface QualifyingTimes {
  readonly advanceHours: number;
  readonly minutes: number;
  readonly protestHours: number;
}

export interface ProtestTimes {
  /** null nei campionati salvati prima: niente proteste di qualifica finché non si modifica il campionato. */
  readonly qualifying: QualifyingTimes | null;
  readonly raceProtestHours: number;
}

export type ProtestTimesIssue = 'qualifyingAdvanceHours' | 'qualifyingMinutes' | 'qualifyingProtestHours' | 'raceProtestHours' | 'overlap';

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const isOneOf = (values: readonly number[], value: unknown): value is number => typeof value === 'number' && values.includes(value);

/** Le qualifiche con la loro finestra delle proteste finiscono dopo l'inizio della gara? */
export const doQualifyingProtestsOverlapRace = (qualifying: QualifyingTimes): boolean =>
  qualifying.minutes * MINUTE_MS + qualifying.protestHours * HOUR_MS > qualifying.advanceHours * HOUR_MS;

/** Convalida i tempi di un campionato di origine sconosciuta: tutti obbligatori, dai menu, senza sovrapposizioni. */
export function readProtestTimes(input: unknown): { readonly isValid: true; readonly times: ProtestTimes } | { readonly isValid: false; readonly issue: ProtestTimesIssue } {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const qualifying = typeof candidate.qualifying === 'object' && candidate.qualifying !== null ? (candidate.qualifying as Record<string, unknown>) : {};
  if (!isOneOf(QUALIFYING_ADVANCE_HOURS, qualifying.advanceHours)) return { isValid: false, issue: 'qualifyingAdvanceHours' };
  if (!isOneOf(QUALIFYING_DURATION_MINUTES, qualifying.minutes)) return { isValid: false, issue: 'qualifyingMinutes' };
  if (!isOneOf(QUALIFYING_PROTEST_HOURS, qualifying.protestHours)) return { isValid: false, issue: 'qualifyingProtestHours' };
  if (!isOneOf(RACE_PROTEST_HOURS, candidate.raceProtestHours)) return { isValid: false, issue: 'raceProtestHours' };
  const times = { qualifying: { advanceHours: qualifying.advanceHours, minutes: qualifying.minutes, protestHours: qualifying.protestHours }, raceProtestHours: candidate.raceProtestHours };
  return doQualifyingProtestsOverlapRace(times.qualifying) ? { isValid: false, issue: 'overlap' } : { isValid: true, times };
}

export interface TimeWindow {
  readonly opensAt: number;
  readonly closesAt: number;
}

export type ProtestSession = 'qualifying' | 'race';

/** Istante di inizio e di fine delle qualifiche di una gara; null senza orari o senza qualifiche nel campionato. */
export function qualifyingInstants(schedule: RaceSchedule, times: ProtestTimes | null): TimeWindow | null {
  const race = raceInstants(schedule);
  if (!race || !times?.qualifying) return null;
  const opensAt = race.startsAt - times.qualifying.advanceHours * HOUR_MS;
  return { opensAt, closesAt: opensAt + times.qualifying.minutes * MINUTE_MS };
}

/** Le due finestre delle proteste di una gara (null quella che non c'è). */
export function protestWindows(schedule: RaceSchedule, times: ProtestTimes | null): Readonly<Record<ProtestSession, TimeWindow | null>> {
  const race = raceInstants(schedule);
  const qualifying = qualifyingInstants(schedule, times);
  return {
    qualifying: qualifying && times?.qualifying ? { opensAt: qualifying.opensAt, closesAt: qualifying.closesAt + times.qualifying.protestHours * HOUR_MS } : null,
    race: race && times ? { opensAt: race.startsAt, closesAt: race.endsAt + times.raceProtestHours * HOUR_MS } : null,
  };
}

/** Sessione per cui adesso si possono mandare proteste (dall'orario di invio); null se nessuna finestra è aperta. */
export function openProtestSession(schedule: RaceSchedule, times: ProtestTimes | null, now = Date.now()): ProtestSession | null {
  const windows = protestWindows(schedule, times);
  const isOpen = (window: TimeWindow | null) => window !== null && now >= window.opensAt && now <= window.closesAt;
  if (isOpen(windows.race)) return 'race';
  return isOpen(windows.qualifying) ? 'qualifying' : null;
}
