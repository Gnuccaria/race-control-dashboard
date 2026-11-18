import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Track } from '../../shared/raceRules';
import { trackMapUrl, type TrackRefreshPreview } from '../../shared/trackRules';
import { createApp } from '../src/app';
import type { Env } from '../src/env';
import { TRACK_MAPS_CREDIT_URL } from '../../shared/trackRules';
import { parseTrackMaps, parseWikiTrackList, type SourceFetch, WIKI_TRACK_LIST_API_URL } from '../src/tracks/trackSources';
import { createTestEnv, getPath, MEMBERSHIPS, sendJson, withSchedule } from './support/testApp';

/* ---------- Siti finti con le pagine vere (copie di novembre 2026) ---------- */

const readFixture = (fileName: string) => readFileSync(join(import.meta.dirname, 'fixtures', fileName), 'utf8');
const WIKITEXT = readFixture('gt7-track-list.wikitext');
const MAPS_PAGE = readFixture('gt-engine-track-maps.html');
const wikiResponse = (wikitext: string) => JSON.stringify({ parse: { title: 'Gran Turismo 7/Track List', wikitext: { '*': wikitext } } });

function fakeSites(overrides: Record<string, string | null> = {}): SourceFetch & { calls: string[] } {
  const pages: Record<string, string> = { [WIKI_TRACK_LIST_API_URL]: wikiResponse(WIKITEXT), [TRACK_MAPS_CREDIT_URL]: MAPS_PAGE };
  const calls: string[] = [];
  const fetchSource = (url: string) => {
    calls.push(url);
    const page = url in overrides ? overrides[url] : pages[url];
    return Promise.resolve(page === null || page === undefined ? new Response('no', { status: 503 }) : new Response(page));
  };
  return Object.assign(fetchSource, { calls });
}

interface RefreshBody {
  readonly preview: TrackRefreshPreview;
  readonly tracks?: Track[];
  readonly error?: { readonly code: string; readonly details?: unknown };
}

describe('lettura delle fonti dei tracciati', () => {
  it('wiki: 85 configurazioni di 42 tracciati, con nazione, lunghezza in metri e senso inverso', () => {
    const layouts = parseWikiTrackList(WIKITEXT);
    expect(layouts).toHaveLength(85);
    expect(new Set(layouts.map((layout) => layout.name)).size).toBe(42);
    expect(layouts.filter((layout) => layout.hasReverseLayout)).toHaveLength(37);
    expect(layouts[0]).toEqual({
      sourceKey: '24 heures du mans racing circuit|full course',
      name: '24 Heures du Mans Racing Circuit',
      configuration: 'Full Course',
      country: 'FR',
      lengthMeters: 13629,
      hasReverseLayout: false,
    });
    // Nazioni scritte come codici sportivi o per nome ("Switzerland", "CRO", "GER", "UAE").
    expect(layouts.find((layout) => layout.name === 'Deep Forest Raceway')?.country).toBe('CH');
    expect(layouts.find((layout) => layout.name === 'Dragon Trail')?.country).toBe('HR');
    expect(layouts.find((layout) => layout.name === 'Yas Marina Circuit')?.country).toBe('AE');
    expect(layouts.find((layout) => layout.configuration === 'Village')).toMatchObject({ name: 'Alsace', lengthMeters: 5423, hasReverseLayout: true });
  });

  it('mappe: una per configurazione, con quella del senso inverso ("-2" o "a2")', () => {
    const maps = parseTrackMaps(MAPS_PAGE);
    expect(maps).toHaveLength(85);
    expect(maps.find((map) => map.file === 'alsace-village.png')).toEqual({ file: 'alsace-village.png', label: 'Alsace Village', reverseFile: 'alsace-village-2.png' });
    expect(maps.find((map) => map.file === 'sardegna-road-a.png')?.reverseFile).toBe('sardegna-road-a2.png');
    expect(maps.find((map) => map.file === 'grand-valley-highway-1.png')?.reverseFile).toBe('grand-valley-highway-1-2.png');
    // Senza testo alternativo il nome viene dal file; le pubblicità (fuori da images/md) non contano.
    expect(maps.find((map) => map.file === 'tsukuba.png')?.label).toBe('tsukuba');
    expect(maps.some((map) => map.file.includes('product-photo'))).toBe(false);
  });
});

describe('POST /tracks/refresh', () => {
  let env: Env;
  const app = (sites?: SourceFetch) => createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }), undefined, sites);
  const call = async (body: unknown, token = 'token-organization', sites: SourceFetch = fakeSites()) => {
    const response = await app(sites)(sendJson('POST', '/tracks/refresh', body, token), env);
    return { status: response.status, body: (await response.json()) as RefreshBody };
  };
  const listTracks = async () => ((await (await app()(getPath('/tracks', 'token-organization'), env)).json()) as { tracks: Track[] }).tracks;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('anteprima senza salvare: mappe abbinate per nome a 84 configurazioni su 85', async () => {
    expect((await call({}, 'token-steward')).status).toBe(403);
    const { status, body } = await call({});
    expect(status).toBe(200);
    expect(body.preview).toMatchObject({ trackCount: 85, updated: [], deleted: [], kept: [], unmatchedLegacy: [] });
    expect(body.preview.inserted).toHaveLength(85);
    expect(body.preview.inserted).toContain('Autodromo Nazionale Monza - No Chicane');
    // SUGO non ha mappa su gt-engine; la mappa del "Northern Isle Infield" non ha una configurazione nel wiki.
    expect(body.preview.layoutsWithoutMap).toEqual([{ sourceKey: 'sugo international racing course|full course', name: 'SUGO International Racing Course - Full Course' }]);
    expect(body.preview.unmatchedMaps).toEqual([{ file: 'northern-isle-infield.png', label: 'Northern Isle Infield' }]);
    expect(await listTracks()).toEqual([]);
  });

  it('salva i tracciati e, scelta a mano, la mappa; poi ricalcola dai dati già scaricati', async () => {
    const sites = fakeSites();
    const saved = await call({ apply: true, mapMatches: [{ sourceKey: 'sugo international racing course|full course', mapFile: 'northern-isle-infield.png' }] }, undefined, sites);
    expect(saved.status).toBe(200);
    expect(saved.body.tracks).toHaveLength(85);
    const tracks = await listTracks();
    expect(tracks.find((track) => track.name === 'Alsace' && track.configuration === 'Village')).toMatchObject({
      country: 'FR',
      lengthMeters: 5423,
      hasReverseLayout: true,
      mapFile: 'alsace-village.png',
      reverseMapFile: 'alsace-village-2.png',
    });
    // Mappa del senso inverso solo per le configurazioni percorribili al contrario.
    expect(tracks.find((track) => track.name === 'Autodromo Nazionale Monza' && track.configuration === 'Full Course')).toMatchObject({ mapFile: 'monza.png', reverseMapFile: null });
    expect(tracks.find((track) => track.name === 'SUGO International Racing Course')?.mapFile).toBe('northern-isle-infield.png');
    expect(trackMapUrl('monza.png')).toBe('https://gt-engine.com/gt7/tracks/images/md/monza.png');

    // Ricalcolo senza riscaricare: nulla da cambiare, e la mappa scelta a mano resta ricordata.
    const recalculated = await call({ refetch: false }, undefined, sites);
    expect(sites.calls).toHaveLength(2);
    expect(recalculated.body.preview).toMatchObject({ inserted: [], updated: [], deleted: [], layoutsWithoutMap: [] });
  });

  it('i vecchi tracciati (CSV) passano alle configurazioni del wiki senza perdere le gare; quelli senza abbinamento si scelgono a mano', async () => {
    await env.CREWS_DB.prepare(
      `INSERT INTO tracks (id, name, name_key, configuration, length_meters, has_reverse_layout) VALUES
        (1, 'Monza', 'monza|full course', 'Full Course', 5793, 0),
        (2, 'Alsace', 'alsace|village', 'Village', 5423, 1),
        (3, 'Imola', 'imola|full course', 'Full Course', 4909, 0),
        (4, 'Vallelunga', 'vallelunga|', NULL, NULL, NULL),
        (5, 'Interlagos', 'interlagos|full course', 'Full Course', 4309, 0)`,
    ).run();
    const race = (round: number, trackId: number, isTrackReversed = false) =>
      withSchedule({ championship: 'Cool1 FIE Championship', duration: 6, round, trackId, isTrackReversed, raceDate: '2026-11-08', results: [] });
    for (const [round, trackId, isTrackReversed] of [[1, 1, false], [2, 2, true], [3, 3, false], [4, 5, false]] as const) {
      expect((await app()(sendJson('POST', '/races', race(round, trackId, isTrackReversed), 'token-organization'), env)).status).toBe(201);
    }

    const preview = (await call({})).body.preview;
    // Monza e Interlagos per nome simile, Alsace per nome uguale; Vallelunga (non usata) si elimina; Imola (usata) resta da scegliere.
    expect(preview.updated.map((change) => change.name)).toEqual(
      expect.arrayContaining(['Monza - Full Course → Autodromo Nazionale Monza - Full Course', 'Interlagos - Full Course → Autódromo de Interlagos - Full Course']),
    );
    expect(preview.deleted).toEqual(['Vallelunga']);
    expect(preview.kept).toEqual(['Imola - Full Course']);
    expect(preview.unmatchedLegacy).toEqual([{ trackId: 3, name: 'Imola - Full Course', usageCount: 1 }]);
    expect(preview.inserted).toHaveLength(82);

    // Imola senza configurazione nel wiki: "nessuna", la sua gara resta senza tracciato.
    const legacyMatches = [{ trackId: 3, sourceKey: null }];
    const chosen = (await call({ refetch: false, legacyMatches })).body.preview;
    expect(chosen.deleted).toEqual(['Vallelunga', 'Imola - Full Course']);
    expect(chosen.unmatchedLegacy).toEqual([{ trackId: 3, name: 'Imola - Full Course', usageCount: 1 }]);
    expect((await call({ refetch: false, legacyMatches, apply: true })).status).toBe(200);

    const tracks = await listTracks();
    expect(tracks).toHaveLength(85);
    expect(tracks.find((track) => track.id === 1)).toMatchObject({ name: 'Autodromo Nazionale Monza', configuration: 'Full Course', country: 'IT', mapFile: 'monza.png' });
    expect(tracks.find((track) => track.id === 2)).toMatchObject({ name: 'Alsace', reverseMapFile: 'alsace-village-2.png' });
    const { results } = await env.CREWS_DB.prepare('SELECT round, track_id, is_track_reversed FROM races ORDER BY round').all();
    expect(results).toEqual([
      { round: 1, track_id: 1, is_track_reversed: 0 },
      { round: 2, track_id: 2, is_track_reversed: 1 },
      { round: 3, track_id: null, is_track_reversed: 0 },
      { round: 4, track_id: 5, is_track_reversed: 0 },
    ]);
  });

  it('un tracciato tolto dal wiki resta finché è usato da una gara', async () => {
    await call({ apply: true });
    const monza = (await listTracks()).find((track) => track.name === 'Autodromo Nazionale Monza' && track.configuration === 'No Chicane');
    await app()(sendJson('POST', '/races', withSchedule({ championship: 'Cool1 FIE Championship', duration: 6, round: 1, trackId: monza?.id, raceDate: '2026-11-08', results: [] }), 'token-organization'), env);
    const withoutMonza = WIKITEXT.replace(/\t\{\{CourseLayout\|name=No Chicane\|link=Autodromo Nazionale Monza[^\n]*\n/, '');
    const sites = fakeSites({ [WIKI_TRACK_LIST_API_URL]: wikiResponse(withoutMonza) });
    const preview = (await call({ apply: true }, undefined, sites)).body.preview;
    expect(preview.kept).toEqual(['Autodromo Nazionale Monza - No Chicane']);
    expect((await listTracks()).some((track) => track.id === monza?.id)).toBe(true);
  });

  it('se un sito non risponde o è cambiato non salva niente', async () => {
    const unreachable = await call({ apply: true }, undefined, fakeSites({ [TRACK_MAPS_CREDIT_URL]: null }));
    expect(unreachable).toMatchObject({ status: 502, body: { error: { code: 'track-source-unreachable', details: { source: 'maps' } } } });
    const changed = await call({ apply: true }, undefined, fakeSites({ [WIKI_TRACK_LIST_API_URL]: wikiResponse('niente tracciati') }));
    expect(changed).toMatchObject({ status: 502, body: { error: { code: 'track-source-changed', details: { source: 'wiki' } } } });
    expect((await call({ mapMatches: [{ sourceKey: 'x', mapFile: '../evil.png' }] })).status).toBe(400);
    expect((await call({ legacyMatches: [{ trackId: 0, sourceKey: null }] })).status).toBe(400);
    expect(await listTracks()).toEqual([]);
  });
});
