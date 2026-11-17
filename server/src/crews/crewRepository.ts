import { type CrewDraft, type SavedCrew, toCrewNameKey } from '../../../shared/crewRules';
import type { SqlDatabase } from '../database/sqlDatabase';

export type CrewConflict = 'number' | 'name' | 'role' | null;

interface CrewRow {
  readonly id: number;
  readonly name: string;
  readonly number: number;
  readonly car_id: number | null;
  readonly championship: CrewDraft['championship'];
  readonly color: string | null;
  readonly discord_channel_id: string | null;
  readonly discord_role_id: string | null;
  readonly created_at: string;
}

const CREW_COLUMNS = 'id, name, number, car_id, championship, color, discord_channel_id, discord_role_id, created_at';

const toSavedCrew = (row: CrewRow): SavedCrew => ({
  id: row.id,
  name: row.name,
  number: row.number,
  carId: row.car_id,
  championship: row.championship,
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

export async function insertCrew(database: SqlDatabase, crew: CrewDraft, createdByDiscordId: string): Promise<SavedCrew> {
  const insertedRow = await database
    .prepare(
      `INSERT INTO crews (name, name_key, number, car_id, championship, color, discord_channel_id, discord_role_id, created_by_discord_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${CREW_COLUMNS}`,
    )
    .bind(crew.name, toCrewNameKey(crew.name), crew.number, crew.carId, crew.championship, crew.color, crew.discordChannelId ?? null, crew.discordRoleId ?? null, createdByDiscordId)
    .first<CrewRow>();

  if (!insertedRow) throw new Error('Il database non ha restituito l’equipaggio inserito.');
  return toSavedCrew(insertedRow);
}

/** Aggiorna l'equipaggio; null se non esiste. */
export async function updateCrew(database: SqlDatabase, crewId: number, crew: CrewDraft): Promise<SavedCrew | null> {
  const updatedRow = await database
    .prepare(
      `UPDATE crews SET name = ?, name_key = ?, number = ?, car_id = ?, championship = ?, color = ?, discord_channel_id = ?,
         discord_role_id = ?
       WHERE id = ?
       RETURNING ${CREW_COLUMNS}`,
    )
    .bind(crew.name, toCrewNameKey(crew.name), crew.number, crew.carId, crew.championship, crew.color, crew.discordChannelId ?? null, crew.discordRoleId ?? null, crewId)
    .first<CrewRow>();
  return updatedRow ? toSavedCrew(updatedRow) : null;
}

/**
 * Elimina in un'unica istruzione (quindi tutti o nessuno) gli equipaggi indicati.
 * Gli id passano come un solo parametro JSON: D1 limita il numero di parametri per query.
 * Restituisce quanti equipaggi sono stati davvero eliminati (id inesistenti vengono ignorati).
 */
export async function deleteCrews(database: SqlDatabase, crewIds: readonly number[]): Promise<number> {
  const { results } = await database
    .prepare('DELETE FROM crews WHERE id IN (SELECT value FROM json_each(?)) RETURNING id')
    .bind(JSON.stringify(crewIds))
    .all<{ id: number }>();
  return results.length;
}

/**
 * Quanti degli equipaggi indicati compaiono in almeno un ordine di arrivo, una penalità o un cambio pilota
 * (e quindi non si possono eliminare).
 */
export async function countCrewsInRaceResults(database: SqlDatabase, crewIds: readonly number[]): Promise<number> {
  const row = await database
    .prepare(
      `SELECT COUNT(DISTINCT crew_id) AS crewCount FROM (
         SELECT crew_id FROM race_results UNION ALL SELECT crew_id FROM penalty_crews UNION ALL SELECT crew_id FROM driver_swaps
       ) WHERE crew_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(crewIds))
    .first<{ crewCount: number }>();
  return row?.crewCount ?? 0;
}
