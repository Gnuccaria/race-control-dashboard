import type { FieldParser } from '@/lib/form/parseFormFields';
import { parseNumberAtLeast, parsePositiveNumber } from '@/lib/numberParsing';
import type { ClockTime } from '../model/clock';
import { DEFAULT_RACE_FORMAT_ID, isRaceFormatId, type RaceFormatId } from '../model/raceFormats';

/** Testo digitato nei campi: la conversione avviene con LAP_FIELD_PARSERS. */
export interface LapCalculatorForm extends Record<string, string> {
  readonly raceFormatId: RaceFormatId;
  readonly averageLapSeconds: string;
  /** Formato "HH:MM" prodotto da <input type="time">. */
  readonly currentTime: string;
  readonly plannedStintEnd: string;
  readonly completedLaps: string;
  readonly totalLaps: string;
  readonly currentLobby: string;
}

/** Valori di esempio presenti nel foglio originale. */
export const DEFAULT_LAP_CALCULATOR_FORM: LapCalculatorForm = {
  raceFormatId: DEFAULT_RACE_FORMAT_ID,
  averageLapSeconds: '120',
  currentTime: '21:05',
  plannedStintEnd: '21:00',
  completedLaps: '29',
  totalLaps: '30',
  currentLobby: '5',
};

const TIME_PATTERN = /^(?<hours>\d{1,2}):(?<minutes>\d{2})/;

/** "HH:MM" o "HH:MM:SS" → ore e minuti; null se il campo è vuoto o non valido. */
export function parseTime(rawValue: string): ClockTime | null {
  const timeGroups = TIME_PATTERN.exec(rawValue.trim())?.groups;
  if (!timeGroups?.hours || !timeGroups.minutes) return null;
  return { hours: Number(timeGroups.hours), minutes: Number(timeGroups.minutes) };
}

/** Stesse soglie della convalida dati del foglio. */
export const LAP_FIELD_PARSERS = {
  averageLapSeconds: { parse: parsePositiveNumber, errorKey: 'averageLapPositive' },
  currentTime: { parse: parseTime, errorKey: 'currentTimeRequired' },
  plannedStintEnd: { parse: parseTime, errorKey: 'plannedStintEndRequired' },
  completedLaps: { parse: parseNumberAtLeast(0), errorKey: 'lapsNonNegative' },
  totalLaps: { parse: parseNumberAtLeast(0), errorKey: 'lapsNonNegative' },
  currentLobby: { parse: parseNumberAtLeast(1), errorKey: 'lobbyStartsAtOne' },
} satisfies Record<string, FieldParser<unknown>>;

/** I valori salvati del formato gara devono essere tra quelli disponibili. */
export function isAllowedLapCalculatorValue(fieldName: keyof LapCalculatorForm, value: string): boolean {
  return fieldName !== 'raceFormatId' || isRaceFormatId(value);
}
