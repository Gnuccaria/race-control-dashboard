/**
 * Regole di un campionato, condivise tra app desktop e server.
 * Un campionato ha un nome unico, da una a tre durate di gara (ore intere), ognuna con la durata dello stint
 * (minuti interi: da qui i cambi pilota attesi) e l'orario di partenza (da qui gli orari di ogni stint e l'orario
 * proposto alle gare nuove), l'elenco delle vetture ammesse, scelte dal catalogo delle auto, e le impostazioni di
 * sessione del gioco (shared/sessionSettingsRules.ts).
 * Gare ed equipaggi si collegano al campionato con il nome: rinominarlo aggiorna anche loro.
 */

import { isRaceTime } from './raceSchedule';
import { readSessionSettings, type SessionSettings } from './sessionSettingsRules';

export const CHAMPIONSHIP_NAME_MAX_LENGTH = 48;
export const CHAMPIONSHIP_DURATIONS_MAX = 3;
export const RACE_HOURS_MIN = 1;
export const RACE_HOURS_MAX = 24;
/** Uno stint dura da 60 a 180 minuti. */
export const STINT_MINUTES_MIN = 60;
export const STINT_MINUTES_MAX = 180;
/** Al massimo 12 stint per gara, quindi 11 cambi pilota. */
export const RACE_STINTS_MAX = 12;

/** Una durata di gara del campionato: 6 ore con stint da 60 minuti = 6 stint = 5 cambi pilota. */
export interface ChampionshipDuration {
  readonly hours: number;
  readonly stintMinutes: number;
  /**
   * Orario di partenza ("HH:MM", ora italiana) delle gare di questa durata: obbligatorio nei campionati salvati da ora;
   * null (o assente) nelle durate salvate prima, finché non si modifica il campionato.
   */
  readonly startTime?: string | null;
}

export interface ChampionshipDraft {
  readonly name: string;
  /** Da una a tre, ognuna con ore diverse, in ordine crescente. */
  readonly durations: readonly ChampionshipDuration[];
  /** Vetture ammesse (id del catalogo delle auto), almeno una. */
  readonly carIds: readonly number[];
  /** Impostazioni della stanza di gioco, per la gara e la qualifica. */
  readonly sessionSettings: SessionSettings;
}

export interface Championship extends ChampionshipDraft {
  readonly id: number;
  readonly createdAt: string;
}

/** Quanti stint ha una gara di quella durata. */
export const stintCount = ({ hours, stintMinutes }: ChampionshipDuration): number => (hours * 60) / stintMinutes;

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** Un orario "HH:MM" spostato di quei minuti, sull'orologio (dopo la mezzanotte si ricomincia da 00:00). */
export function addMinutesToClock(time: string, minutes: number): string {
  const [hours = 0, startMinutes = 0] = time.split(':').map(Number);
  const total = (((hours * 60 + startMinutes + minutes) % 1440) + 1440) % 1440;
  return `${twoDigits(Math.floor(total / 60))}:${twoDigits(total % 60)}`;
}

/** Orario di inizio di ogni stint: la partenza, poi una durata dello stint dopo l'altra. Vuoto senza partenza. */
export const stintStartTimes = (duration: ChampionshipDuration): string[] =>
  duration.startTime && isRaceTime(duration.startTime)
    ? Array.from({ length: stintCount(duration) }, (_unused, index) => addMinutesToClock(duration.startTime as string, index * duration.stintMinutes))
    : [];

/** Cambi pilota attesi: uno in meno degli stint. */
export const driverSwapCountFor = (duration: ChampionshipDuration): number => Math.max(0, stintCount(duration) - 1);

/** Il campionato con quel nome (senza badare a maiuscole), se esiste. */
export const findChampionship = <Item extends Pick<Championship, 'name'>>(championships: readonly Item[], name: string): Item | undefined => {
  const key = toChampionshipKey(name);
  return championships.find((championship) => toChampionshipKey(championship.name) === key);
};

/** Durate del campionato (nessuna per un campionato sconosciuto). */
export const championshipDurations = (championships: readonly Pick<Championship, 'name' | 'durations'>[], name: string): readonly ChampionshipDuration[] =>
  findChampionship(championships, name)?.durations ?? [];

/** La durata che si può dare per scontata: l'unica del campionato. */
export const onlyDurationOf = (championships: readonly Pick<Championship, 'name' | 'durations'>[], name: string): number | null => {
  const durations = championshipDurations(championships, name);
  return durations.length === 1 ? (durations[0]?.hours ?? null) : null;
};

/** Cambi pilota di una gara di quel campionato e di quella durata (0 se il campionato o la durata non ci sono). */
export const driverSwapCountOf = (championships: readonly Pick<Championship, 'name' | 'durations'>[], name: string, hours: number | null): number => {
  const duration = championshipDurations(championships, name).find((candidate) => candidate.hours === hours);
  return duration ? driverSwapCountFor(duration) : 0;
};

/** Forma canonica del nome: spazi iniziali e finali tolti, spazi multipli ridotti a uno. */
export const normalizeChampionshipName = (rawName: string): string => rawName.normalize('NFC').trim().replace(/\s+/g, ' ');

/** Chiave per i duplicati: "Cool1 FIE" e "cool1  fie" sono lo stesso campionato. */
export const toChampionshipKey = (name: string): string => normalizeChampionshipName(name).toLowerCase();

/** Lettere, cifre, spazi e la punteggiatura dei nomi reali ("GT3 Series – Sprint", "24h Le Mans", "Cup (2027)"). */
const CHAMPIONSHIP_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,'’&()/+–-]*$/u;

export type ChampionshipNameIssue = 'required' | 'invalid-characters' | 'too-long';

export function findChampionshipNameIssue(rawName: string): ChampionshipNameIssue | null {
  const name = normalizeChampionshipName(rawName);
  if (name === '') return 'required';
  if ([...name].length > CHAMPIONSHIP_NAME_MAX_LENGTH) return 'too-long';
  return CHAMPIONSHIP_NAME_PATTERN.test(name) ? null : 'invalid-characters';
}

/**
 * Problema di una durata: hours = ore non intere o fuori da 1–24; stint = minuti non interi o fuori da 60–180;
 * not-divisor = la gara non si divide in stint interi; too-many-stints = più di 12 stint.
 */
export type ChampionshipDurationIssue = 'hours' | 'stint' | 'not-divisor' | 'too-many-stints';

const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

export function findDurationIssue(hours: unknown, stintMinutes: unknown): ChampionshipDurationIssue | null {
  if (!isInteger(hours) || hours < RACE_HOURS_MIN || hours > RACE_HOURS_MAX) return 'hours';
  if (!isInteger(stintMinutes) || stintMinutes < STINT_MINUTES_MIN || stintMinutes > STINT_MINUTES_MAX) return 'stint';
  if ((hours * 60) % stintMinutes !== 0) return 'not-divisor';
  if ((hours * 60) / stintMinutes > RACE_STINTS_MAX) return 'too-many-stints';
  return null;
}

export interface ChampionshipDraftIssues {
  readonly name?: ChampionshipNameIssue;
  /** required = nessuna; too-many = più di tre; repeated = stesse ore due volte; gli altri come findDurationIssue. */
  readonly durations?: 'required' | 'too-many' | 'repeated' | 'invalid' | ChampionshipDurationIssue | 'start-time';
  /** required = nessuna vettura; invalid = id non valido; repeated = stessa vettura due volte. */
  readonly carIds?: 'required' | 'invalid' | 'repeated';
  /** La voce (della gara o della qualifica) senza un valore ammesso. */
  readonly sessionSettings?: { readonly session: 'race' | 'qualifying'; readonly key: string };
}

export type ChampionshipDraftValidation =
  | { readonly isValid: true; readonly championship: ChampionshipDraft }
  | { readonly isValid: false; readonly issues: ChampionshipDraftIssues };

function readDurations(rawValue: unknown): ChampionshipDuration[] | NonNullable<ChampionshipDraftIssues['durations']> {
  if (!Array.isArray(rawValue)) return 'invalid';
  if (rawValue.length === 0) return 'required';
  if (rawValue.length > CHAMPIONSHIP_DURATIONS_MAX) return 'too-many';
  const durations: ChampionshipDuration[] = [];
  for (const rawDuration of rawValue as unknown[]) {
    const { hours, stintMinutes, startTime } = (typeof rawDuration === 'object' && rawDuration !== null ? rawDuration : {}) as Record<string, unknown>;
    const issue = findDurationIssue(hours, stintMinutes);
    if (issue) return issue;
    if (!isRaceTime(startTime)) return 'start-time';
    if (durations.some((duration) => duration.hours === hours)) return 'repeated';
    durations.push({ hours: hours as number, stintMinutes: stintMinutes as number, startTime });
  }
  return durations.sort((first, second) => first.hours - second.hours);
}

function readCarIds(rawValue: unknown): number[] | NonNullable<ChampionshipDraftIssues['carIds']> {
  if (!Array.isArray(rawValue)) return 'invalid';
  if (rawValue.length === 0) return 'required';
  if (!rawValue.every((carId) => isInteger(carId) && carId > 0)) return 'invalid';
  const carIds = rawValue as number[];
  return new Set(carIds).size === carIds.length ? [...carIds] : 'repeated';
}

/** Convalida dati di origine sconosciuta (che le auto esistano lo controlla il server). */
export function validateChampionshipDraft(input: unknown): ChampionshipDraftValidation {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const name = typeof candidate.name === 'string' ? normalizeChampionshipName(candidate.name) : '';
  const nameIssue = findChampionshipNameIssue(name);
  const durations = readDurations(candidate.durations);
  const carIds = readCarIds(candidate.carIds);
  const sessionSettings = readSessionSettings(candidate.sessionSettings);
  if (nameIssue || typeof durations === 'string' || typeof carIds === 'string' || !sessionSettings.isValid) {
    return {
      isValid: false,
      issues: {
        ...(nameIssue && { name: nameIssue }),
        ...(typeof durations === 'string' && { durations }),
        ...(typeof carIds === 'string' && { carIds }),
        ...(!sessionSettings.isValid && { sessionSettings: { session: sessionSettings.session, key: sessionSettings.key } }),
      },
    };
  }
  return { isValid: true, championship: { name, durations, carIds, sessionSettings: sessionSettings.settings } };
}

/** Campionati in ordine alfabetico, senza badare alle maiuscole. */
export const sortChampionshipNames = (names: readonly string[]): string[] =>
  [...names].sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }));
