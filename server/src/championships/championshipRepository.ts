import { type Championship, type ChampionshipDraft, type ChampionshipDuration, sortChampionshipNames, toChampionshipKey } from '../../../shared/championshipRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface ChampionshipRow {
  readonly id: number;
  readonly name: string;
  readonly created_at: string;
  /** Durate come elenco JSON (championship_durations). */
  readonly durations_json: string | null;
  /** Vetture ammesse come elenco JSON di id (car_championships). */
  readonly car_ids_json: string | null;
}

const CHAMPIONSHIP_COLUMNS = `id, name, created_at,
  (SELECT json_group_array(json_object('hours', hours, 'stintMinutes', stint_minutes))
   FROM championship_durations WHERE championship_durations.championship_id = championships.id) AS durations_json,
  (SELECT json_group_array(car_id) FROM car_championships WHERE car_championships.championship = championships.name) AS car_ids_json`;

function parseJsonArray(json: string | null): unknown[] {
  try {
    const values = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(values) ? values : [];
  } catch {
    return [];
  }
}

const toChampionship = (row: ChampionshipRow): Championship => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  durations: parseJsonArray(row.durations_json)
    .filter((value): value is ChampionshipDuration => typeof value === 'object' && value !== null && 'hours' in value && 'stintMinutes' in value)
    .sort((first, second) => first.hours - second.hours),
  carIds: parseJsonArray(row.car_ids_json)
    .filter((value): value is number => typeof value === 'number')
    .sort((first, second) => first - second),
});

/** Tutti i campionati, in ordine alfabetico. */
export async function listChampionships(database: SqlDatabase): Promise<Championship[]> {
  const { results } = await database.prepare(`SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships`).all<ChampionshipRow>();
  const championships = results.map(toChampionship);
  const order = sortChampionshipNames(championships.map((championship) => championship.name));
  return championships.sort((first, second) => order.indexOf(first.name) - order.indexOf(second.name));
}

export async function findChampionshipById(database: SqlDatabase, championshipId: number): Promise<Championship | null> {
  const row = await database.prepare(`SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships WHERE id = ?`).bind(championshipId).first<ChampionshipRow>();
  return row ? toChampionship(row) : null;
}

/** Esiste già un altro campionato con lo stesso nome (senza badare a maiuscole)? */
export async function isChampionshipNameTaken(database: SqlDatabase, name: string, excludedChampionshipId = -1): Promise<boolean> {
  const row = await database.prepare('SELECT id FROM championships WHERE name_key = ? AND id <> ?').bind(toChampionshipKey(name), excludedChampionshipId).first();
  return row !== null;
}

/** Durate e vetture come parametri JSON: D1 limita il numero di parametri per query. */
const insertDurationsSql = (championshipIdSql: string) =>
  `INSERT INTO championship_durations (championship_id, hours, stint_minutes)
   SELECT ${championshipIdSql}, json_extract(value, '$.hours'), json_extract(value, '$.stintMinutes') FROM json_each(?)`;
const INSERT_CARS_SQL = 'INSERT INTO car_championships (car_id, championship) SELECT value, ? FROM json_each(?)';

/** Campionato, durate e vetture ammesse in un'unica transazione. */
export async function insertChampionship(database: SqlDatabase, championship: ChampionshipDraft, createdByDiscordId: string): Promise<Championship> {
  const nameKey = toChampionshipKey(championship.name);
  await database.batch([
    database.prepare('INSERT INTO championships (name, name_key, created_by_discord_id) VALUES (?, ?, ?)').bind(championship.name, nameKey, createdByDiscordId),
    database.prepare(insertDurationsSql('(SELECT id FROM championships WHERE name_key = ?)')).bind(nameKey, JSON.stringify(championship.durations)),
    // Vetture ammesse rimaste da un campionato eliminato con lo stesso nome: si ripulisce prima di inserire.
    database.prepare('DELETE FROM car_championships WHERE championship = ?').bind(championship.name),
    database.prepare(INSERT_CARS_SQL).bind(championship.name, JSON.stringify(championship.carIds)),
  ]);
  const row = await database.prepare(`SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships WHERE name_key = ?`).bind(nameKey).first<ChampionshipRow>();
  if (!row) throw new Error('Il database non ha restituito il campionato inserito.');
  return toChampionship(row);
}

/**
 * Aggiorna il campionato in un'unica transazione: un nome nuovo passa a gare, equipaggi e proteste collegati;
 * durate e vetture ammesse si sostituiscono. Gli equipaggi con un'auto non più ammessa restano nel campionato
 * senza auto (da completare in "Gestisci equipaggio").
 */
export async function updateChampionship(database: SqlDatabase, previous: Championship, championship: ChampionshipDraft): Promise<Championship | null> {
  const { name } = championship;
  const carIdsJson = JSON.stringify(championship.carIds);
  await database.batch([
    database.prepare('UPDATE championships SET name = ?, name_key = ? WHERE id = ?').bind(name, toChampionshipKey(name), previous.id),
    database.prepare('UPDATE races SET championship = ? WHERE championship = ?').bind(name, previous.name),
    database.prepare('UPDATE crew_championships SET championship = ? WHERE championship = ?').bind(name, previous.name),
    database.prepare('UPDATE protests SET championship = ? WHERE championship = ?').bind(name, previous.name),
    database.prepare('DELETE FROM championship_durations WHERE championship_id = ?').bind(previous.id),
    database.prepare(insertDurationsSql('?')).bind(previous.id, JSON.stringify(championship.durations)),
    database.prepare('DELETE FROM car_championships WHERE championship IN (?, ?)').bind(previous.name, name),
    database.prepare(INSERT_CARS_SQL).bind(name, carIdsJson),
    database
      .prepare('UPDATE crew_championships SET car_id = NULL WHERE championship = ? AND car_id IS NOT NULL AND car_id NOT IN (SELECT value FROM json_each(?))')
      .bind(name, carIdsJson),
  ]);
  return findChampionshipById(database, previous.id);
}

/** Quante gare ha il campionato (con gare non si può eliminare). */
export async function countChampionshipRaces(database: SqlDatabase, name: string): Promise<number> {
  const row = await database.prepare('SELECT COUNT(*) AS raceCount FROM races WHERE championship = ?').bind(name).first<{ raceCount: number }>();
  return row?.raceCount ?? 0;
}

/** Ore delle durate usate da almeno una gara del campionato. */
export async function listUsedDurations(database: SqlDatabase, name: string): Promise<number[]> {
  const { results } = await database
    .prepare('SELECT DISTINCT duration FROM races WHERE championship = ? AND duration IS NOT NULL')
    .bind(name)
    .all<{ duration: number }>();
  return results.map((row) => row.duration);
}

/**
 * Elimina i campionati: gli equipaggi perdono il collegamento (chi non ne ha altri resta senza campionato),
 * le vetture non sono più ammesse. Tutto in un'unica transazione.
 */
export async function deleteChampionships(database: SqlDatabase, championships: readonly Championship[]): Promise<void> {
  if (championships.length === 0) return;
  const namesJson = JSON.stringify(championships.map((championship) => championship.name));
  const idsJson = JSON.stringify(championships.map((championship) => championship.id));
  await database.batch([
    database.prepare('DELETE FROM crew_championships WHERE championship IN (SELECT value FROM json_each(?))').bind(namesJson),
    database.prepare('DELETE FROM car_championships WHERE championship IN (SELECT value FROM json_each(?))').bind(namesJson),
    database.prepare('DELETE FROM championship_durations WHERE championship_id IN (SELECT value FROM json_each(?))').bind(idsJson),
    database.prepare('DELETE FROM championships WHERE id IN (SELECT value FROM json_each(?))').bind(idsJson),
  ]);
}
