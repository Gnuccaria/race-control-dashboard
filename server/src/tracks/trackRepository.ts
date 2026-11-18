import { type Track } from '../../../shared/raceRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface TrackRow {
  readonly id: number;
  readonly name: string;
  readonly configuration: string | null;
  readonly country: string | null;
  readonly length_meters: number | null;
  readonly has_reverse_layout: number | null;
  readonly map_file: string | null;
  readonly reverse_map_file: string | null;
}

const TRACK_COLUMNS = 'id, name, configuration, country, length_meters, has_reverse_layout, map_file, reverse_map_file';

const toTrack = (row: TrackRow): Track => ({
  id: row.id,
  name: row.name,
  configuration: row.configuration,
  country: row.country,
  lengthMeters: row.length_meters,
  hasReverseLayout: row.has_reverse_layout === null ? null : row.has_reverse_layout === 1,
  mapFile: row.map_file,
  reverseMapFile: row.reverse_map_file,
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

/** Tracciato salvato, con la chiave del wiki (null per quelli importati dal CSV) e quante gare lo usano. */
export type StoredTrack = Track & { readonly sourceKey: string | null; readonly usageCount: number };

export async function listStoredTracks(database: SqlDatabase): Promise<StoredTrack[]> {
  const { results } = await database
    .prepare(`SELECT ${TRACK_COLUMNS}, source_key, (SELECT COUNT(*) FROM races WHERE races.track_id = tracks.id) AS usage_count FROM tracks`)
    .all<TrackRow & { readonly source_key: string | null; readonly usage_count: number }>();
  return results.map((row) => ({ ...toTrack(row), sourceKey: row.source_key, usageCount: row.usage_count }));
}
