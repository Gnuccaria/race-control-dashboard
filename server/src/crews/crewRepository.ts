import { type CrewChampionshipEntry, type CrewDraft, isCrewChampionship, type SavedCrew, sortCrewChampionships, toCrewNameKey } from '../../../shared/crewRules';
import type { SqlDatabase } from '../database/sqlDatabase';

export type CrewConflict = 'number' | 'name' | 'role' | null;

interface CrewRow {
  readonly id: number;
  readonly name: string;
  readonly number: number;
  /** Campionati con l'auto, come elenco JSON (crew_championships). */
  readonly championships_json: string | null;
  readonly color: string | null;
  readonly discord_channel_id: string | null;
  readonly discord_role_id: string | null;
  readonly created_at: string;
}

const CREW_COLUMNS = `id, name, number, color, discord_channel_id, discord_role_id, created_at,
  (SELECT json_group_array(json_object('championship', championship, 'carId', car_id))
   FROM crew_championships WHERE crew_championships.crew_id = crews.id) AS championships_json`;

/** Campionati dal JSON del database, in ordine alfabetico. */
function readChampionships(json: string | null): CrewChampionshipEntry[] {
  try {
    const entries = JSON.parse(json ?? '[]') as { championship?: unknown; carId?: unknown }[];
    return sortCrewChampionships(
      entries.flatMap(({ championship, carId }) => (isCrewChampionship(championship) ? [{ championship, carId: typeof carId === 'number' ? carId : null }] : [])),
    );
  } catch {
    return [];
  }
}

const toSavedCrew = (row: CrewRow): SavedCrew => ({
  id: row.id,
  name: row.name,
  number: row.number,
  championships: readChampionships(row.championships_json),
  color: row.color,
  discordChannelId: row.discord_channel_id,
  discordRoleId: row.discord_role_id,
  createdAt: row.created_at,
});

export async function listCrews(database: SqlDatabase): Promise<SavedCrew[]> {
  const { results } = await database.prepare(`SELECT ${CREW_COLUMNS} FROM crews ORDER BY number`).all<CrewRow>();
  return results.map(toSavedCrew);
}

export async function findCrewById(database: SqlDatabase, crewId: number): Promise<SavedCrew | null> {
  const row = await database.prepare(`SELECT ${CREW_COLUMNS} FROM crews WHERE id = ?`).bind(crewId).first<CrewRow>();
  return row ? toSavedCrew(row) : null;
}

/**
 * Controlla prima il numero, poi il nome (senza distinguere maiuscole e minuscole), poi il ruolo Discord.
 * In modifica si passa l'id dell'equipaggio stesso, che non è in conflitto con sé.
 */
export async function findCrewConflict(database: SqlDatabase, crew: CrewDraft, excludedCrewId = -1): Promise<CrewConflict> {
  const sameNumber = await database
    .prepare('SELECT id FROM crews WHERE number = ? AND id <> ?')
    .bind(crew.number, excludedCrewId)
    .first();
  if (sameNumber) return 'number';

  const sameName = await database
    .prepare('SELECT id FROM crews WHERE name_key = ? AND id <> ?')
    .bind(toCrewNameKey(crew.name), excludedCrewId)
    .first();
  if (sameName) return 'name';

  if (!crew.discordRoleId) return null;
  const sameRole = await database
    .prepare('SELECT id FROM crews WHERE discord_role_id = ? AND id <> ?')
    .bind(crew.discordRoleId, excludedCrewId)
    .first();
  return sameRole ? 'role' : null;
}

/** Campionati dell'equipaggio come un solo parametro JSON: D1 limita il numero di parametri per query. */
const toChampionshipsJson = (crew: CrewDraft) => JSON.stringify(crew.championships);

/** Inserisce i campionati dell'equipaggio; crewIdSql = espressione SQL che dà l'id dell'equipaggio. */
const insertChampionshipsSql = (crewIdSql: string) =>
  `INSERT INTO crew_championships (crew_id, championship, car_id)
   SELECT ${crewIdSql}, json_extract(value, '$.championship'), json_extract(value, '$.carId') FROM json_each(?)`;

/** Equipaggio e campionati in un'unica transazione. */
export async function insertCrew(database: SqlDatabase, crew: CrewDraft, createdByDiscordId: string): Promise<SavedCrew> {
  await database.batch([
    database
      .prepare(
        `INSERT INTO crews (name, name_key, number, color, discord_channel_id, discord_role_id, created_by_discord_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crew.name, toCrewNameKey(crew.name), crew.number, crew.color, crew.discordChannelId ?? null, crew.discordRoleId ?? null, createdByDiscordId),
    // L'equipaggio appena inserito si ritrova dal numero, che è unico.
    database.prepare(insertChampionshipsSql('(SELECT id FROM crews WHERE number = ?)')).bind(crew.number, toChampionshipsJson(crew)),
  ]);
  const insertedRow = await database.prepare(`SELECT ${CREW_COLUMNS} FROM crews WHERE number = ?`).bind(crew.number).first<CrewRow>();
  if (!insertedRow) throw new Error('Il database non ha restituito l’equipaggio inserito.');
  return toSavedCrew(insertedRow);
}

/** Aggiorna l'equipaggio e sostituisce i suoi campionati, in un'unica transazione; null se non esiste. */
export async function updateCrew(database: SqlDatabase, crewId: number, crew: CrewDraft): Promise<SavedCrew | null> {
  await database.batch([
    database
      .prepare(
        `UPDATE crews SET name = ?, name_key = ?, number = ?, color = ?, discord_channel_id = ?, discord_role_id = ?
         WHERE id = ?`,
      )
      .bind(crew.name, toCrewNameKey(crew.name), crew.number, crew.color, crew.discordChannelId ?? null, crew.discordRoleId ?? null, crewId),
    database.prepare('DELETE FROM crew_championships WHERE crew_id = ?').bind(crewId),
    database.prepare(insertChampionshipsSql('?')).bind(crewId, toChampionshipsJson(crew)),
  ]);
  return findCrewById(database, crewId);
}

/**
 * Elimina in un'unica istruzione (quindi tutti o nessuno) gli equipaggi indicati.
 * Gli id passano come un solo parametro JSON: D1 limita il numero di parametri per query.
 * Restituisce quanti equipaggi sono stati davvero eliminati (id inesistenti vengono ignorati).
 */
export async function deleteCrews(database: SqlDatabase, crewIds: readonly number[]): Promise<number> {
  const idsJson = JSON.stringify(crewIds);
  const [, deleted] = await database.batch<{ id: number }>([
    database.prepare('DELETE FROM crew_championships WHERE crew_id IN (SELECT value FROM json_each(?))').bind(idsJson),
    database.prepare('DELETE FROM crews WHERE id IN (SELECT value FROM json_each(?)) RETURNING id').bind(idsJson),
  ]);
  return deleted?.results.length ?? 0;
}

/**
 * Quanti degli equipaggi indicati compaiono in almeno un ordine di arrivo, una penalità o un cambio pilota
 * (e quindi non si possono eliminare).
 */
export async function countCrewsInRaceResults(database: SqlDatabase, crewIds: readonly number[]): Promise<number> {
  const row = await database
    .prepare(
      `SELECT COUNT(DISTINCT crew_id) AS crewCount FROM (
         SELECT crew_id FROM race_results UNION ALL SELECT crew_id FROM race_qualifying UNION ALL SELECT crew_id FROM penalty_crews UNION ALL SELECT crew_id FROM driver_swaps
       ) WHERE crew_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(crewIds))
    .first<{ crewCount: number }>();
  return row?.crewCount ?? 0;
}
