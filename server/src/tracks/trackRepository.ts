import { type Track, toTrackKey } from '../../../shared/raceRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface TrackRow {
  readonly id: number;
  readonly name: string;
  readonly configuration: string | null;
  readonly continent: string | null;
  readonly length_meters: number | null;
  readonly has_reverse_layout: number | null;
}

const TRACK_COLUMNS = 'id, name, configuration, continent, length_meters, has_reverse_layout';

const toTrack = (row: TrackRow): Track => ({
  id: row.id,
  name: row.name,
  configuration: row.configuration,
  continent: row.continent,
  lengthMeters: row.length_meters,
  hasReverseLayout: row.has_reverse_layout === null ? null : row.has_reverse_layout === 1,
});

export async function listTracks(database: SqlDatabase): Promise<Track[]> {
  const { results } = await database
    .prepare(`SELECT ${TRACK_COLUMNS} FROM tracks ORDER BY name COLLATE NOCASE, configuration COLLATE NOCASE`)
    .all<TrackRow>();
  return results.map(toTrack);
}

export async function findTrackById(database: SqlDatabase, trackId: number): Promise<Track | null> {
  const row = await database.prepare(`SELECT ${TRACK_COLUMNS} FROM tracks WHERE id = ?`).bind(trackId).first<TrackRow>();
  return row ? toTrack(row) : null;
}

/** Pista senza configurazione con questo nome già presente? */
export async function isTrackNameTaken(database: SqlDatabase, name: string): Promise<boolean> {
  return (await database.prepare('SELECT id FROM tracks WHERE name_key = ?').bind(toTrackKey({ name, configuration: null })).first()) !== null;
}

export async function insertTrack(database: SqlDatabase, name: string): Promise<Track> {
  const insertedRow = await database
    .prepare(`INSERT INTO tracks (name, name_key) VALUES (?, ?) RETURNING ${TRACK_COLUMNS}`)
    .bind(name, toTrackKey({ name, configuration: null }))
    .first<TrackRow>();
  if (!insertedRow) throw new Error('Il database non ha restituito la pista inserita.');
  return toTrack(insertedRow);
}
