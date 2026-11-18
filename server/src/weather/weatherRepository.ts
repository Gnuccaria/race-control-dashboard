import { findChampionship, stintCount } from '../../../shared/championshipRules';
import type { RaceSummary } from '../../../shared/raceRules';
import { fitWeatherPattern, type RaceWeather, type WeatherPattern } from '../../../shared/weatherRules';
import { listChampionships } from '../championships/championshipRepository';
import type { SqlDatabase } from '../database/sqlDatabase';

/** Stint della gara: dalla durata e dallo stint di quella durata nel campionato (0 se non si sa). */
export async function raceStintCount(database: SqlDatabase, race: Pick<RaceSummary, 'championship' | 'duration'>): Promise<number> {
  const championship = findChampionship(await listChampionships(database), race.championship);
  const duration = championship?.durations.find((candidate) => candidate.hours === race.duration);
  return duration ? stintCount(duration) : 0;
}

async function readPattern(database: SqlDatabase, raceId: number): Promise<WeatherPattern | null> {
  const row = await database.prepare('SELECT pattern FROM race_weather WHERE race_id = ?').bind(raceId).first<{ pattern: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.pattern) as WeatherPattern;
  } catch {
    return null;
  }
}

/** Meteo della gara: il numero di stint e il pattern salvato, adattato agli stint attuali (null se non c'è). */
export async function findRaceWeather(database: SqlDatabase, race: Pick<RaceSummary, 'id' | 'championship' | 'duration'>): Promise<RaceWeather> {
  const count = await raceStintCount(database, race);
  const pattern = await readPattern(database, race.id);
  return { stintCount: count, pattern: pattern ? fitWeatherPattern(pattern, count) : null };
}

export async function saveRaceWeather(database: SqlDatabase, raceId: number, pattern: WeatherPattern, discordUserId: string): Promise<void> {
  await database
    .prepare(
      `INSERT INTO race_weather (race_id, pattern, updated_by_discord_id) VALUES (?, ?, ?)
       ON CONFLICT (race_id) DO UPDATE SET pattern = excluded.pattern, updated_by_discord_id = excluded.updated_by_discord_id,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(raceId, JSON.stringify(pattern), discordUserId)
    .run();
}
