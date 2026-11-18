/**
 * Pattern meteo di una gara, condiviso tra app (Crea pattern meteo), server e sito (scheda Meteo).
 * Una riga per la qualifica, con 2 slot, poi una riga per ogni stint della gara, con 9 slot ciascuna.
 * Ogni slot ha un codice meteo: S01–S13 (sole), C01–C06 (nuvole), R01–R08 (pioggia). Tutti obbligatori.
 * Il numero di stint viene dalla durata della gara e dallo stint del campionato (shared/championshipRules.ts).
 */

export const QUALIFYING_WEATHER_SLOTS = 2;
export const STINT_WEATHER_SLOTS = 9;

const codes = (prefix: string, count: number) => Array.from({ length: count }, (_unused, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);

/** Tutti i codici, nell'ordine dei menu: S01…S13, C01…C06, R01…R08. */
export const WEATHER_CODES: readonly string[] = [...codes('S', 13), ...codes('C', 6), ...codes('R', 8)];

export const isWeatherCode = (value: unknown): value is string => typeof value === 'string' && WEATHER_CODES.includes(value);

/** Tipo di meteo di un codice, con la sua icona sul sito. */
export type WeatherKind = 'sun' | 'sun-fog' | 'light-clouds' | 'dense-clouds' | 'light-rain' | 'heavy-rain';

/** S01–S07 sole, S08–S13 sole con leggera nebbia, C01–C03 nuvole leggere, C04–C06 nuvole dense, R01–R04 pioggia leggera, R05–R08 pioggia pesante. */
export function weatherKindOf(code: string): WeatherKind {
  const number = Number(code.slice(1));
  if (code.startsWith('S')) return number <= 7 ? 'sun' : 'sun-fog';
  if (code.startsWith('C')) return number <= 3 ? 'light-clouds' : 'dense-clouds';
  return number <= 4 ? 'light-rain' : 'heavy-rain';
}

export interface WeatherPattern {
  /** I 2 slot della qualifica. */
  readonly qualifying: readonly string[];
  /** Una riga per stint, 9 slot ciascuna. */
  readonly stints: readonly (readonly string[])[];
}

/** Pattern meteo di una gara, con il numero di stint previsto (per costruire le righe anche senza pattern). */
export interface RaceWeather {
  readonly stintCount: number;
  readonly pattern: WeatherPattern | null;
}

const isRow = (value: unknown, length: number): value is string[] => Array.isArray(value) && value.length === length && value.every(isWeatherCode);

/**
 * Convalida un pattern di origine sconosciuta per una gara con stintCount stint: la qualifica con 2 codici, esattamente
 * stintCount righe di 9 codici, nessuno slot vuoto. null se non valido.
 */
export function readWeatherPattern(input: unknown, stintCount: number): WeatherPattern | null {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  if (!isRow(candidate.qualifying, QUALIFYING_WEATHER_SLOTS)) return null;
  if (!Array.isArray(candidate.stints) || candidate.stints.length !== stintCount || stintCount < 1) return null;
  if (!candidate.stints.every((row) => isRow(row, STINT_WEATHER_SLOTS))) return null;
  return { qualifying: [...candidate.qualifying], stints: candidate.stints.map((row) => [...(row as string[])]) };
}

/**
 * Un pattern salvato adattato agli stint attuali della gara (se nel frattempo la durata è cambiata):
 * le righe in più si tolgono, quelle mancanti restano vuote ('').
 */
export function fitWeatherPattern(pattern: WeatherPattern, stintCount: number): WeatherPattern {
  return {
    qualifying: pattern.qualifying,
    stints: Array.from({ length: stintCount }, (_unused, index) => pattern.stints[index] ?? Array.from({ length: STINT_WEATHER_SLOTS }, () => '')),
  };
}
