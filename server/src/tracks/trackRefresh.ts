import { formatTrackName, toTrackKey } from '../../../shared/raceRules';
import type { LegacyTrackMatch, TrackMapMatch, TrackRefreshChange, TrackRefreshPreview } from '../../../shared/trackRules';
import type { SqlDatabase } from '../database/sqlDatabase';
import type { StoredTrack } from './trackRepository';
import { type attachTrackMaps, type MappedTrackLayout, matchByName, type TrackMap, type WikiTrackLayout } from './trackSources';

/**
 * Confronto tra le configurazioni del wiki (con le mappe) e i tracciati salvati, senza perdere le gare collegate:
 * - un tracciato già aggiornato dai siti si ritrova dalla chiave del wiki (source_key);
 * - un vecchio tracciato (importato dal CSV) passa alla configurazione scelta a mano nell'anteprima, oppure a quella
 *   con lo stesso nome o con il nome più simile; scelto "nessuna", le sue gare restano senza tracciato;
 * - i tracciati non più nel wiki (o vecchi senza abbinamento) si eliminano, tranne quelli usati da gare, che restano.
 */
export interface TrackRefreshPlan {
  readonly inserts: readonly MappedTrackLayout[];
  readonly updates: readonly { readonly existing: StoredTrack; readonly layout: MappedTrackLayout }[];
  readonly deletes: readonly StoredTrack[];
  /** Vecchi tracciati scelti "nessuna configurazione": le gare restano senza tracciato, poi si eliminano. */
  readonly detached: readonly StoredTrack[];
  readonly kept: readonly StoredTrack[];
  /** Vecchi tracciati usati da gare abbinati a mano: restano nell'elenco da scegliere dell'anteprima. */
  readonly manuallyMatched: readonly StoredTrack[];
}

const layoutName = (layout: Pick<WikiTrackLayout, 'name' | 'configuration'>) => formatTrackName(layout);

export function planTrackRefresh(layouts: readonly MappedTrackLayout[], stored: readonly StoredTrack[], legacyMatches: readonly LegacyTrackMatch[]): TrackRefreshPlan {
  const layoutByKey = new Map(layouts.map((layout) => [layout.sourceKey, layout]));
  const taken = new Set<string>();
  const updates: { existing: StoredTrack; layout: MappedTrackLayout }[] = [];
  const take = (existing: StoredTrack, layout: MappedTrackLayout) => {
    taken.add(layout.sourceKey);
    updates.push({ existing, layout });
  };

  // 1. Tracciati già aggiornati dai siti: dalla chiave del wiki.
  const remaining: StoredTrack[] = [];
  for (const existing of stored) {
    const layout = existing.sourceKey === null ? undefined : layoutByKey.get(existing.sourceKey);
    if (layout && !taken.has(layout.sourceKey)) take(existing, layout);
    else remaining.push(existing);
  }

  // 2. Vecchi tracciati: scelta a mano, poi stesso nome e configurazione, poi il nome più simile.
  const manualByTrackId = new Map(legacyMatches.map((match) => [match.trackId, match.sourceKey]));
  const detached: StoredTrack[] = [];
  const manuallyMatched: StoredTrack[] = [];
  const unmatched: StoredTrack[] = [];
  for (const existing of remaining) {
    const manualKey = manualByTrackId.get(existing.id);
    if (manualKey === null && existing.sourceKey === null) {
      detached.push(existing);
      continue;
    }
    const manualLayout = manualKey === undefined || manualKey === null ? undefined : layoutByKey.get(manualKey);
    if (manualLayout && !taken.has(manualLayout.sourceKey)) {
      take(existing, manualLayout);
      if (existing.sourceKey === null) manuallyMatched.push(existing);
    } else unmatched.push(existing);
  }
  const legacy = unmatched.filter((existing) => existing.sourceKey === null);
  const sameKey = (existing: StoredTrack) => layouts.find((layout) => !taken.has(layout.sourceKey) && toTrackKey(layout) === toTrackKey(existing));
  const stillUnmatched: StoredTrack[] = unmatched.filter((existing) => existing.sourceKey !== null);
  const byNameCandidates: StoredTrack[] = [];
  for (const existing of legacy) {
    const layout = sameKey(existing);
    if (layout) take(existing, layout);
    else byNameCandidates.push(existing);
  }
  const byName = matchByName(
    byNameCandidates,
    layouts.filter((layout) => !taken.has(layout.sourceKey)),
    (existing) => `${existing.name} ${existing.configuration ?? ''}`,
    (layout) => `${layout.name} ${layout.configuration}`,
  );
  for (const existing of byNameCandidates) {
    const layout = byName.get(existing);
    if (layout && !taken.has(layout.sourceKey)) take(existing, layout);
    else stillUnmatched.push(existing);
  }

  return {
    inserts: layouts.filter((layout) => !taken.has(layout.sourceKey)),
    updates,
    deletes: stillUnmatched.filter((existing) => existing.usageCount === 0),
    detached,
    kept: stillUnmatched.filter((existing) => existing.usageCount > 0),
    manuallyMatched,
  };
}

const CHANGE_FIELDS = ['country', 'lengthMeters', 'hasReverseLayout', 'mapFile', 'reverseMapFile'] as const;

export function describeTrackRefresh(plan: TrackRefreshPlan, attached: ReturnType<typeof attachTrackMaps>): TrackRefreshPreview {
  const updated: TrackRefreshChange[] = plan.updates.flatMap(({ existing, layout }) => {
    const renamed = toTrackKey(existing) !== toTrackKey(layout);
    const changes = CHANGE_FIELDS.filter((field) => existing[field] !== layout[field]).map((field) => ({ field, before: existing[field], after: layout[field] }));
    if (!renamed && changes.length === 0) return [];
    return [{ name: renamed ? `${formatTrackName(existing)} → ${layoutName(layout)}` : layoutName(layout), changes }];
  });
  return {
    trackCount: attached.layouts.length,
    inserted: plan.inserts.map(layoutName),
    updated,
    deleted: [...plan.deletes, ...plan.detached].map(formatTrackName),
    kept: plan.kept.map(formatTrackName),
    unmatchedLegacy: [...plan.kept.filter((existing) => existing.sourceKey === null), ...plan.manuallyMatched, ...plan.detached.filter((existing) => existing.usageCount > 0)]
      .sort((first, second) => formatTrackName(first).localeCompare(formatTrackName(second)))
      .map((existing) => ({ trackId: existing.id, name: formatTrackName(existing), usageCount: existing.usageCount })),
    layouts: attached.layouts.map((layout) => ({ sourceKey: layout.sourceKey, name: layoutName(layout) })),
    layoutsWithoutMap: attached.layoutsWithoutMap.map((layout) => ({ sourceKey: layout.sourceKey, name: layoutName(layout) })),
    unmatchedMaps: attached.unmatchedMaps.map((map) => ({ file: map.file, label: map.label })),
  };
}

/** Abbinamenti delle mappe scelti a mano negli aggiornamenti precedenti. */
export async function listSavedMapMatches(database: SqlDatabase): Promise<TrackMapMatch[]> {
  const { results } = await database.prepare('SELECT source_key, map_file FROM track_map_matches').all<{ source_key: string; map_file: string | null }>();
  return results.map((row) => ({ sourceKey: row.source_key, mapFile: row.map_file }));
}

/** Quelli della richiesta prendono il posto di quelli salvati per la stessa configurazione. */
export const combineMapMatches = (saved: readonly TrackMapMatch[], requested: readonly TrackMapMatch[]): TrackMapMatch[] => [
  ...saved.filter((match) => !requested.some((request) => request.sourceKey === match.sourceKey)),
  ...requested,
];

const trackJson = (layout: MappedTrackLayout, id?: number) => ({
  id,
  name: layout.name,
  nameKey: toTrackKey(layout),
  configuration: layout.configuration,
  country: layout.country,
  lengthMeters: layout.lengthMeters,
  hasReverseLayout: layout.hasReverseLayout ? 1 : 0,
  mapFile: layout.mapFile,
  reverseMapFile: layout.reverseMapFile,
  sourceKey: layout.sourceKey,
});

const TRACK_COLUMNS = [
  ['name', 'name'],
  ['name_key', 'nameKey'],
  ['configuration', 'configuration'],
  ['country', 'country'],
  ['length_meters', 'lengthMeters'],
  ['has_reverse_layout', 'hasReverseLayout'],
  ['map_file', 'mapFile'],
  ['reverse_map_file', 'reverseMapFile'],
  ['source_key', 'sourceKey'],
] as const;
const COLUMN_NAMES = TRACK_COLUMNS.map(([column]) => column).join(', ');
const VALUES_FROM_JSON = TRACK_COLUMNS.map(([column, field]) => `json_extract(value, '$.${field}') AS ${column}`).join(', ');
const SET_FROM_CHANGED = TRACK_COLUMNS.map(([column]) => `${column} = changed.${column}`).join(', ');

/**
 * Applica il piano in un'unica transazione, con poche istruzioni (i dati passano come JSON): le gare dei tracciati
 * scelti "nessuna" restano senza, eliminazioni, chiavi provvisorie (così due tracciati che si scambiano il nome non si
 * scontrano sugli indici unici), i tracciati che restano prendono una chiave che non serve più a nessuno,
 * aggiornamenti, inserimenti, gare "al contrario" su configurazioni che non lo prevedono più, abbinamenti delle mappe.
 */
export async function applyTrackRefresh(database: SqlDatabase, plan: TrackRefreshPlan, requestedMapMatches: readonly TrackMapMatch[]): Promise<void> {
  const detachedIds = JSON.stringify(plan.detached.map((track) => track.id));
  const deletedIds = JSON.stringify([...plan.deletes, ...plan.detached].map((track) => track.id));
  const updates = JSON.stringify(plan.updates.map(({ existing, layout }) => trackJson(layout, existing.id)));
  const keptIds = JSON.stringify(plan.kept.map((track) => track.id));
  await database.batch([
    database.prepare('UPDATE races SET track_id = NULL, is_track_reversed = 0 WHERE track_id IN (SELECT value FROM json_each(?))').bind(detachedIds),
    database.prepare('DELETE FROM tracks WHERE id IN (SELECT value FROM json_each(?))').bind(deletedIds),
    database
      .prepare("UPDATE tracks SET name_key = '~' || id, source_key = NULL WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?))")
      .bind(updates),
    database.prepare("UPDATE tracks SET name_key = 'kept:' || id, source_key = NULL WHERE id IN (SELECT value FROM json_each(?))").bind(keptIds),
    database
      .prepare(`UPDATE tracks SET ${SET_FROM_CHANGED} FROM (SELECT json_extract(value, '$.id') AS id, ${VALUES_FROM_JSON} FROM json_each(?)) AS changed WHERE tracks.id = changed.id`)
      .bind(updates),
    database.prepare(`INSERT INTO tracks (${COLUMN_NAMES}) SELECT ${VALUES_FROM_JSON} FROM json_each(?)`).bind(JSON.stringify(plan.inserts.map((layout) => trackJson(layout)))),
    database.prepare('UPDATE races SET is_track_reversed = 0 WHERE is_track_reversed = 1 AND track_id IN (SELECT id FROM tracks WHERE has_reverse_layout = 0)'),
    database
      .prepare("INSERT OR REPLACE INTO track_map_matches (source_key, map_file) SELECT json_extract(value, '$.sourceKey'), json_extract(value, '$.mapFile') FROM json_each(?)")
      .bind(JSON.stringify(requestedMapMatches)),
  ]);
}

/** Fonti lette dall'ultimo "Aggiorna dati": ricalcolo e salvataggio le riusano senza riscaricare i siti. */
export interface StagedTrackSources {
  readonly layouts: readonly WikiTrackLayout[];
  readonly maps: readonly TrackMap[];
}

const STAGED_SOURCES_KEY = 'track_sources';

export async function saveStagedTrackSources(database: SqlDatabase, sources: StagedTrackSources, discordUserId: string): Promise<void> {
  await database
    .prepare(
      `INSERT INTO app_settings (key, value, updated_by_discord_id) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by_discord_id = excluded.updated_by_discord_id,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(STAGED_SOURCES_KEY, JSON.stringify(sources), discordUserId)
    .run();
}

/** null se non c'è un "Aggiorna dati" precedente (o il dato salvato non si legge). */
export async function readStagedTrackSources(database: SqlDatabase): Promise<StagedTrackSources | null> {
  const row = await database.prepare('SELECT value FROM app_settings WHERE key = ?').bind(STAGED_SOURCES_KEY).first<{ value: string }>();
  if (!row) return null;
  try {
    const sources = JSON.parse(row.value) as StagedTrackSources;
    return Array.isArray(sources.layouts) && Array.isArray(sources.maps) ? sources : null;
  } catch {
    return null;
  }
}
