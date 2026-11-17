import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PROTESTS_PER_DAY, PROTEST_VIDEO_MAX_BYTES, validateProtestDraft, youtubeVideoIdFrom } from '../../shared/protestRules';
import { createApp } from '../src/app';
import type { Env, VideoBucket } from '../src/env';
import { clearGuildRoleNamesForTests } from '../src/siteAuth/discordGuildRoles';
import { clearSiteMembersForTests } from '../src/siteAuth/siteDiscordAuth';
import { createTestEnv, getPath, MEMBERSHIPS, readError, REQUIRED_DETAILS, sendJson } from './support/testApp';

const SITE = 'https://race-control-api.test';
const VEZ_ROLE = '1571641908688588963';
const GUILD_ROLES = [
  { id: VEZ_ROLE, name: '#16 Vez Team Lime' },
  { id: 'role-pilot', name: 'Pilota' },
];
const SITE_USERS: Record<string, { id: string; username: string; global_name: string; roles: string[] }> = {
  'Bearer site-vez': { id: '111', username: 'niko_rc', global_name: 'Niko', roles: [VEZ_ROLE] },
  'Bearer site-vez-2': { id: '222', username: 'luca', global_name: 'Luca', roles: [VEZ_ROLE] },
  'Bearer site-no-crew': { id: '333', username: 'ale', global_name: 'Ale', roles: ['role-pilot'] },
};

/** Bucket R2 in memoria: conserva i byte e il tipo di ogni video. */
function memoryBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const bucket: VideoBucket = {
    async put(key, value, options) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return { body: new Response(object.bytes).body as ReadableStream, size: object.bytes.length, httpMetadata: { contentType: object.contentType } };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return { bucket, objects };
}

describe('proteste', () => {
  let env: Env;
  let videos: ReturnType<typeof memoryBucket>;
  let handleRequest: ReturnType<typeof createApp>;

  const discordFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get('Authorization');
    if (url.endsWith('/guilds/guild-1/roles')) return new Response(JSON.stringify(GUILD_ROLES), { status: 200 });
    const user = authorization ? SITE_USERS[authorization] : undefined;
    if (user) return new Response(JSON.stringify({ nick: null, roles: user.roles, user: { ...user, avatar: null } }), { status: 200 });
    return new Response('{}', { status: 401 });
  }) as typeof fetch;

  const siteRequest = async (method: 'GET' | 'POST', path: string, token: string, body?: unknown) => {
    const response = await handleRequest(
      new Request(`${SITE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      }),
      env,
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const protest = (overrides: Record<string, unknown> = {}) => ({
    raceId: 1,
    stint: 2,
    lap: 14,
    corner: ' Variante  Ascari ',
    description: 'La #44 frena tardi\r\ne mi tampona.  ',
    youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ?t=42',
    otherCrewIds: [2],
    ...overrides,
  });
  const submit = (body: unknown, token = 'site-vez') => siteRequest('POST', '/public/protests', token, body);
  const uploadVideo = (protestId: number, bytes: Uint8Array, contentType = 'video/mp4', token = 'site-vez', declaredSize = bytes.length) =>
    handleRequest(
      new Request(`${SITE}/public/protests/${protestId}/video`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType, 'Content-Length': String(declaredSize) },
        body: bytes,
      }),
      env,
    );

  beforeEach(async () => {
    clearGuildRoleNamesForTests();
    clearSiteMembersForTests();
    videos = memoryBucket();
    env = { ...createTestEnv(), DISCORD_BOT_TOKEN: 'bot-token', PROTEST_VIDEOS: videos.bucket };
    handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }), discordFetch);
    const crews = [
      { name: 'Vez Team Lime', number: 16, ...REQUIRED_DETAILS },
      { name: 'Firestarter Project', number: 44, ...REQUIRED_DETAILS },
      { name: 'GT Extreme Drivers', number: 26, ...REQUIRED_DETAILS },
      { name: 'Team Kyoto', number: 8, championship: 'All Japan GT Championship', color: '#283593' },
    ];
    for (const crew of crews) await handleRequest(sendJson('POST', '/crews', { ...crew, carId: 1 }, 'token-director'), env);
    // Gare: 1 e 3 accettano proteste (FIE e All Japan GT), 2 no.
    await env.CREWS_DB.prepare(
      `INSERT INTO races (id, name, championship, round, race_date, created_by_discord_id, accepts_protests) VALUES
        (1, '6 Ore di Monza', 'Cool1 FIE Championship', 1, '2026-10-05', 't', 1),
        (2, NULL, 'Cool1 FIE Championship', 2, '2026-11-02', 't', 0),
        (3, NULL, 'All Japan GT Championship', 1, '2026-10-12', 't', 1)`,
    ).run();
  });

  it('legge il link YouTube in tutte le forme comuni', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      expect([link, youtubeVideoIdFrom(link)]).toEqual([link, 'dQw4w9WgXcQ']);
    }
    for (const link of ['https://vimeo.com/123', 'https://youtube.com/watch?v=corto', 'ciao', 'https://evil.com/watch?v=dQw4w9WgXcQ']) {
      expect([link, youtubeVideoIdFrom(link)]).toEqual([link, null]);
    }
  });

  it('convalida: gara, stint, giro e curva obbligatori; descrizione, link e altri equipaggi facoltativi', () => {
    expect(validateProtestDraft({ raceId: 3, stint: 1, lap: 1, corner: '3' })).toEqual({
      isValid: true,
      protest: { raceId: 3, stint: 1, lap: 1, corner: '3', description: '', youtubeVideoId: null, otherCrewIds: [] },
    });
    expect(validateProtestDraft({})).toEqual({ isValid: false, issues: { raceId: 'required', stint: 'required', lap: 'required', corner: 'required' } });
    expect(
      validateProtestDraft({
        raceId: 'Serie X',
        stint: 21,
        lap: 0,
        corner: 'x'.repeat(41),
        description: 'a'.repeat(501),
        youtubeUrl: 'vimeo.com/1',
        otherCrewIds: [2, 2],
      }),
    ).toEqual({
      isValid: false,
      issues: { raceId: 'invalid', stint: 'invalid', lap: 'invalid', corner: 'invalid', description: 'too-long', youtubeUrl: 'invalid', otherCrewIds: 'invalid' },
    });
    expect(validateProtestDraft({ raceId: 1, stint: 1, lap: 1, corner: '3', description: 'a'.repeat(500) }).isValid).toBe(true);
  });

  it('il modulo riceve l’equipaggio dal ruolo, le gare del suo campionato che accettano proteste e gli altri equipaggi', async () => {
    expect(await siteRequest('GET', '/public/protests/form', 'site-vez')).toEqual({
      status: 200,
      body: {
        crew: { id: 1, number: 16, name: 'Vez Team Lime', championship: 'Cool1 FIE Championship' },
        races: [{ id: 1, name: '6 Ore di Monza', round: 1, championship: 'Cool1 FIE Championship', raceDate: '2026-10-05' }],
        otherCrews: [
          { id: 3, number: 26, name: 'GT Extreme Drivers', color: '#E10600' },
          { id: 2, number: 44, name: 'Firestarter Project', color: '#E10600' },
        ],
      },
    });
    expect(await siteRequest('GET', '/public/protests/form', 'site-no-crew')).toMatchObject({ status: 422, body: { error: { code: 'no-crew-role' } } });
    expect((await siteRequest('GET', '/public/protests/form', '')).status).toBe(401);
  });

  it('l’Organizzazione apre e chiude le proteste di una gara', async () => {
    const setting = (raceId: number, body: unknown, token = 'token-organization') => handleRequest(sendJson('PUT', `/races/${raceId}/protests`, body, token), env);
    expect(await (await setting(2, { acceptsProtests: true })).json()).toEqual({ acceptsProtests: true });
    expect(await (await handleRequest(getPath('/races/2', 'token-director'), env)).json()).toMatchObject({ race: { acceptsProtests: true } });
    expect((await siteRequest('GET', '/public/protests/form', 'site-vez')).body).toMatchObject({ races: [{ id: 2 }, { id: 1 }] });
    await setting(1, { acceptsProtests: false });
    expect((await siteRequest('GET', '/public/protests/form', 'site-vez')).body).toMatchObject({ races: [{ id: 2 }] });
    expect(await submit(protest({ raceId: 1 }))).toMatchObject({ status: 422, body: { error: { details: { raceId: 'invalid' } } } });
    expect((await setting(2, { acceptsProtests: 'sì' })).status).toBe(422);
    expect((await setting(9, { acceptsProtests: true })).status).toBe(404);
    expect((await setting(2, { acceptsProtests: false }, 'token-steward')).status).toBe(403);
  });

  it('salva la protesta e i Commissari la leggono nell’app', async () => {
    expect(await submit(protest())).toEqual({ status: 201, body: { protest: { id: 1 } } });
    const list = await handleRequest(getPath('/protests', 'token-director'), env);
    const expected = {
      id: 1,
      crew: { id: 1, number: 16, name: 'Vez Team Lime' },
      championship: 'Cool1 FIE Championship',
      race: { id: 1, name: '6 Ore di Monza', round: 1, championship: 'Cool1 FIE Championship' },
      stint: 2,
      lap: 14,
      corner: 'Variante Ascari',
      description: 'La #44 frena tardi\ne mi tampona.',
      youtubeVideoId: 'dQw4w9WgXcQ',
      otherCrews: [{ id: 2, number: 44, name: 'Firestarter Project' }],
      video: null,
      submittedByName: 'Niko',
      submittedByUsername: 'niko_rc',
    };
    expect(await list.json()).toMatchObject({ protests: [expected] });
    expect(await (await handleRequest(getPath('/protests/1', 'token-director'), env)).json()).toMatchObject({ protest: expected });
    expect((await handleRequest(getPath('/protests/9', 'token-director'), env)).status).toBe(404);
    expect((await handleRequest(getPath('/protests', 'token-no-role'), env)).status).toBe(403);
  });

  it('solo gare del proprio campionato che accettano proteste; altri equipaggi della gara e mai il proprio', async () => {
    expect(await submit(protest({ raceId: 3 }))).toMatchObject({ status: 422, body: { error: { details: { raceId: 'invalid' } } } });
    expect(await submit(protest({ raceId: 2 }))).toMatchObject({ status: 422, body: { error: { details: { raceId: 'invalid' } } } });
    expect(await submit(protest({ otherCrewIds: [4] }))).toMatchObject({ status: 422, body: { error: { code: 'invalid-protest', details: { otherCrewIds: 'invalid' } } } });
    expect(await submit(protest({ otherCrewIds: [1] }))).toMatchObject({ status: 422 });
    expect(await submit(protest({ corner: '' }))).toMatchObject({ status: 422, body: { error: { details: { corner: 'required' } } } });
    expect(await submit(protest({ otherCrewIds: [3, 2] }))).toMatchObject({ status: 201 });
  });

  it(`al massimo ${MAX_PROTESTS_PER_DAY} proteste al giorno a persona`, async () => {
    for (let index = 0; index < MAX_PROTESTS_PER_DAY; index += 1) expect((await submit(protest())).status).toBe(201);
    expect(await submit(protest())).toMatchObject({ status: 429, body: { error: { code: 'too-many-protests' } } });
    expect((await submit(protest(), 'site-vez-2')).status).toBe(201);
  });

  it('video: lo carica solo chi ha mandato la protesta, una volta, nei formati e nei limiti previsti; l’app lo riceve', async () => {
    await submit(protest());
    const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    expect((await uploadVideo(1, bytes, 'video/mp4', 'site-vez-2')).status).toBe(404);
    expect((await uploadVideo(1, bytes, 'image/png')).status).toBe(422);
    expect((await uploadVideo(1, bytes, 'video/mp4', 'site-vez', PROTEST_VIDEO_MAX_BYTES + 1)).status).toBe(413);

    const uploaded = await uploadVideo(1, bytes);
    expect(uploaded.status).toBe(200);
    expect(await uploaded.json()).toEqual({ video: { contentType: 'video/mp4', size: 8 } });
    expect((await uploadVideo(1, bytes)).status).toBe(409);
    expect(videos.objects.size).toBe(1);

    expect(await (await handleRequest(getPath('/protests/1', 'token-director'), env)).json()).toMatchObject({ protest: { video: { contentType: 'video/mp4', size: 8 } } });
    const video = await handleRequest(getPath('/protests/1/video', 'token-director'), env);
    expect(video.status).toBe(200);
    expect(video.headers.get('Content-Type')).toBe('video/mp4');
    expect(new Uint8Array(await video.arrayBuffer())).toEqual(bytes);
    expect((await handleRequest(getPath('/protests/1/video', 'token-no-role'), env)).status).toBe(403);
  });

  const ageProtest = (modifier: string) =>
    env.CREWS_DB.prepare(`UPDATE protests SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '${modifier}')`).run();
  const putYoutube = (protestId: number, youtubeUrl: string, token = 'site-vez') =>
    handleRequest(
      new Request(`${SITE}/public/protests/${protestId}/youtube`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
      }),
      env,
    );
  const review = (protestId: number, body: unknown, token = 'token-director') =>
    handleRequest(sendJson('PUT', `/protests/${protestId}/review`, body, token), env);

  it('video e link YouTube si aggiungono fino a 24 ore dall’invio, poi non più; senza bucket i video sono rifiutati', async () => {
    await submit(protest({ youtubeUrl: '' }));
    await ageProtest('-23 hours');
    expect(await siteRequest('GET', '/public/protests/1', 'site-vez')).toMatchObject({ body: { protest: { canAddVideo: true, canAddYoutube: true } } });
    expect((await putYoutube(1, 'vimeo.com/1')).status).toBe(422);
    const added = await putYoutube(1, 'https://youtu.be/dQw4w9WgXcQ');
    expect(added.status).toBe(200);
    expect(await added.json()).toMatchObject({ protest: { youtubeVideoId: 'dQw4w9WgXcQ', canAddYoutube: false, canAddVideo: true } });
    expect((await putYoutube(1, 'https://youtu.be/dQw4w9WgXcQ')).status).toBe(409);
    expect((await putYoutube(1, 'https://youtu.be/dQw4w9WgXcQ', 'site-vez-2')).status).toBe(404);

    await ageProtest('-25 hours');
    expect(await siteRequest('GET', '/public/protests/1', 'site-vez')).toMatchObject({ body: { protest: { canAddVideo: false, canAddYoutube: false } } });
    expect((await uploadVideo(1, new Uint8Array([1]))).status).toBe(409);
    await submit(protest({ youtubeUrl: '' }));
    await env.CREWS_DB.prepare("UPDATE protests SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2").run();
    env = { ...env, PROTEST_VIDEOS: undefined };
    expect((await uploadVideo(2, new Uint8Array([1]))).status).toBe(503);
  });

  it('l’equipaggio vede le sue proteste e il video; gli altri no', async () => {
    await submit(protest());
    await uploadVideo(1, new Uint8Array([1, 2, 3]));
    const mine = await siteRequest('GET', '/public/protests/mine', 'site-vez-2');
    expect(mine).toMatchObject({ status: 200, body: { protests: [{ id: 1, status: 'open', canAddVideo: false, canAddYoutube: false }] } });
    // Dell'esito il sito vede solo lo stato.
    expect((mine.body.protests as Record<string, unknown>[])[0]).not.toHaveProperty('rejectionReason');
    expect((mine.body.protests as Record<string, unknown>[])[0]).not.toHaveProperty('penalty');
    const video = await handleRequest(new Request(`${SITE}/public/protests/1/video`, { headers: { Authorization: 'Bearer site-vez-2' } }), env);
    expect(new Uint8Array(await video.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await siteRequest('GET', '/public/protests/1', 'site-no-crew')).status).toBe(404);
    expect(await siteRequest('GET', '/public/protests/mine', 'site-no-crew')).toEqual({ status: 200, body: { protests: [] } });
  });

  it('passati 30 giorni dall’invio il video è scaduto, anche prima che R2 lo cancelli', async () => {
    await submit(protest());
    await uploadVideo(1, new Uint8Array([1]));
    await ageProtest('-31 days');
    expect(await (await handleRequest(getPath('/protests/1', 'token-director'), env)).json()).toMatchObject({ protest: { video: { isExpired: true } } });
    expect((await handleRequest(getPath('/protests/1/video', 'token-director'), env)).status).toBe(410);
    videos.objects.clear();
    await ageProtest('-1 day');
    expect((await handleRequest(getPath('/protests/1/video', 'token-director'), env)).status).toBe(410);
  });

  it('i Commissari respingono la protesta con la motivazione obbligatoria; il sito vede solo che è respinta', async () => {
    await submit(protest());
    expect((await review(1, { decision: 'rejected', reason: '   ' })).status).toBe(422);
    const rejected = await review(1, { decision: 'rejected', reason: '  Contatto di gara: nessuna azione.  ' });
    expect(rejected.status).toBe(200);
    expect(await rejected.json()).toMatchObject({ protest: { status: 'rejected', rejectionReason: 'Contatto di gara: nessuna azione.', penalty: null } });
    const onSite = await siteRequest('GET', '/public/protests/1', 'site-vez-2');
    expect(onSite).toMatchObject({ body: { protest: { status: 'rejected' } } });
    expect(onSite.body.protest).not.toHaveProperty('rejectionReason');
    const stored = await env.CREWS_DB.prepare('SELECT reviewed_by_discord_id AS reviewedBy FROM protests').first();
    expect(stored).toEqual({ reviewedBy: 'discord-42' });

    // L'esito è definitivo.
    const again = await review(1, { decision: 'rejected', reason: 'Cambio idea' });
    expect(again.status).toBe(409);
    expect(await readError(again)).toBe('protest-already-reviewed');
  });

  const acceptedPenalty = (overrides: Record<string, unknown> = {}) => ({
    crews: [
      { crewId: 2, decision: 'time-5' },
      { crewId: 1, decision: null },
    ],
    violation: '2.5.1',
    document: 'code-of-conduct',
    reason: 'La #44 tampona la #16 alla Variante Ascari.',
    ...overrides,
  });

  it('accolta: la penalità si salva tra quelle della gara, tradotta in inglese, e la protesta la mostra', async () => {
    env = {
      ...env,
      AI: { run: (_model, inputs) => Promise.resolve({ response: { reason: `EN(${JSON.parse((inputs.messages as { content: string }[]).at(-1)?.content ?? '{}').reason as string})` } }) },
    };
    await submit(protest());
    const accepted = await review(1, { decision: 'accepted', penalty: acceptedPenalty() });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      protest: {
        status: 'accepted',
        rejectionReason: null,
        penalty: { id: 1, crews: [{ crewId: 1, decision: null }, { crewId: 2, decision: 'time-5' }], violation: '2.5.1', document: 'code-of-conduct' },
      },
    });
    // Tra le penalità della gara, come le altre: va nel referto PDF, con la traduzione automatica.
    const penalties = (await (await handleRequest(getPath('/races/1/penalties', 'token-director'), env)).json()) as { penalties: Record<string, unknown>[] };
    expect(penalties.penalties).toHaveLength(1);
    expect(penalties.penalties[0]).toMatchObject({ violation: '2.5.1', english: { reason: 'EN(La #44 tampona la #16 alla Variante Ascari.)', source: 'automatic' } });
    const onSite = await siteRequest('GET', '/public/protests/1', 'site-vez');
    expect(onSite).toMatchObject({ body: { protest: { status: 'accepted' } } });
    expect(onSite.body.protest).not.toHaveProperty('penalty');
    expect((await review(1, { decision: 'rejected', reason: 'no' })).status).toBe(409);
  });

  it('accolta: vetture della protesta, violazione, documento e motivazione obbligatori', async () => {
    await submit(protest());
    const invalid = async (penalty: unknown) => ((await (await review(1, { decision: 'accepted', penalty })).json()) as { error: { details: unknown } }).error.details;
    expect(await invalid(acceptedPenalty({ violation: '', document: '', reason: '' }))).toEqual({ penalty: { violation: 'required', document: 'required' } });
    expect(await invalid(acceptedPenalty({ reason: '  ' }))).toEqual({ penalty: { reason: 'required' } });
    expect(await invalid(acceptedPenalty({ crews: [{ crewId: 2, decision: 'time-5' }] }))).toEqual({ penalty: { crews: 'not-protest-crews' } });
    expect(await invalid(acceptedPenalty({ crews: [{ crewId: 1, decision: null }, { crewId: 2, decision: null }, { crewId: 3, decision: null }] }))).toEqual({
      penalty: { crews: 'not-protest-crews' },
    });
    expect((await review(1, { decision: 'forse' })).status).toBe(422);
    expect((await review(9, { decision: 'rejected', reason: 'x' })).status).toBe(404);
    expect((await review(1, { decision: 'rejected', reason: 'x' }, 'token-no-role')).status).toBe(403);
    // Una protesta senza gara (mandata prima) si può solo respingere.
    await env.CREWS_DB.prepare('UPDATE protests SET race_id = NULL').run();
    expect(await readError(await review(1, { decision: 'accepted', penalty: acceptedPenalty() }))).toBe('protest-without-race');
  });
});

describe('ruoli dell’app: Direzione Gara e Commissari Sportivi', () => {
  it('ognuno usa i suoi strumenti; equipaggi e gare si leggono con entrambi i ruoli', async () => {
    const env = createTestEnv();
    const handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }));
    const status = async (request: Request) => (await handleRequest(request, env)).status;

    expect(await status(getPath('/protests', 'token-steward'))).toBe(200);
    expect(await status(getPath('/protests', 'token-race-control'))).toBe(403);
    expect(await status(getPath('/disconnection-tickets', 'token-race-control'))).toBe(200);
    expect(await status(getPath('/disconnection-tickets', 'token-steward'))).toBe(403);
    expect(await status(getPath('/crews', 'token-steward'))).toBe(200);
    expect(await status(getPath('/races', 'token-steward'))).toBe(200);
    expect(await status(sendJson('POST', '/crews', { name: 'Alfa', number: 7, carId: 1, ...REQUIRED_DETAILS }, 'token-steward'))).toBe(403);
    expect(await status(sendJson('POST', '/crews', { name: 'Alfa', number: 7, carId: 1, ...REQUIRED_DETAILS }, 'token-race-control'))).toBe(403);
    expect(await status(sendJson('POST', '/crews', { name: 'Alfa', number: 7, carId: 1, ...REQUIRED_DETAILS }, 'token-organization'))).toBe(201);
    expect(await status(getPath('/disconnection-tickets', 'token-organization'))).toBe(403);
    expect(await status(getPath('/protests', 'token-organization'))).toBe(403);
  });

  it('il Commissario salva solo i cambi pilota di una gara già creata; il salvataggio della gara intera non li tocca', async () => {
    const env = createTestEnv();
    const handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }));
    await handleRequest(sendJson('POST', '/crews', { name: 'Alfa', number: 7, carId: 1, ...REQUIRED_DETAILS }, 'token-organization'), env);
    await handleRequest(sendJson('POST', '/crews', { name: 'Kyoto', number: 8, carId: 1, championship: 'All Japan GT Championship', color: '#283593' }, 'token-organization'), env);
    const race = { championship: 'Cool1 FIE Championship', duration: '6 hours', round: 1, raceDate: '2026-09-14', results: [{ position: 1, crewId: 1, laps: 30, gapMs: null }] };
    expect((await handleRequest(sendJson('POST', '/races', race, 'token-organization'), env)).status).toBe(201);
    const swap = { swap: 1, crewId: 1, pitInMs: 3_600_000, pitOutMs: 600_000, isCancelled: false, notes: 'Box' };

    expect((await handleRequest(sendJson('PUT', '/races/1', race, 'token-steward'), env)).status).toBe(403);
    expect((await handleRequest(sendJson('PUT', '/races/1/driver-swaps', { driverSwaps: [swap] }, 'token-organization'), env)).status).toBe(403);
    expect((await handleRequest(sendJson('PUT', '/races/9/driver-swaps', { driverSwaps: [swap] }, 'token-steward'), env)).status).toBe(404);
    expect((await handleRequest(sendJson('PUT', '/races/1/driver-swaps', { driverSwaps: [{ ...swap, crewId: 2 }] }, 'token-steward'), env)).status).toBe(422);
    expect((await handleRequest(sendJson('PUT', '/races/1/driver-swaps', { driverSwaps: [{ ...swap, swap: 9 }] }, 'token-steward'), env)).status).toBe(422);
    const saved = await handleRequest(sendJson('PUT', '/races/1/driver-swaps', { driverSwaps: [swap] }, 'token-steward'), env);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ race: { driverSwaps: [{ swap: 1, crewId: 1, notes: 'Box' }] } });

    // L'Organizzazione salva la gara (anche con cambi pilota diversi nel corpo): quelli salvati restano.
    expect((await handleRequest(sendJson('PUT', '/races/1', { ...race, totalLaps: 31, driverSwaps: [] }, 'token-organization'), env)).status).toBe(200);
    expect(await (await handleRequest(getPath('/races/1', 'token-steward'), env)).json()).toMatchObject({ race: { totalLaps: 31, driverSwaps: [{ notes: 'Box' }] } });
  });
});
