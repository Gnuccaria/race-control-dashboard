/** Tabella dei formati gara (righe 60-64 del foglio). */
export interface RaceFormat {
  readonly id: string;
  readonly hours: number;
  readonly stintMinutes: number;
}

export const RACE_FORMATS = [
  { id: '3h', hours: 3, stintMinutes: 90 },
  { id: '6h', hours: 6, stintMinutes: 60 },
  { id: '10h', hours: 10, stintMinutes: (10 * 60) / 6 },
  { id: '12h', hours: 12, stintMinutes: 120 },
] as const satisfies readonly RaceFormat[];

export type RaceFormatId = (typeof RACE_FORMATS)[number]['id'];

export const DEFAULT_RACE_FORMAT_ID: RaceFormatId = '6h';

export function isRaceFormatId(value: unknown): value is RaceFormatId {
  return RACE_FORMATS.some((format) => format.id === value);
}

export function getRaceFormat(id: RaceFormatId): RaceFormat {
  return RACE_FORMATS.find((format) => format.id === id) ?? RACE_FORMATS[1];
}

/** N° stint = ore × 60 / durata stint. */
export function getStintCount({ hours, stintMinutes }: RaceFormat): number {
  return (hours * 60) / stintMinutes;
}
