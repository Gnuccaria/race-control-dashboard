import { beforeEach, describe, expect, it } from 'vitest';
import { crewNumberFromRoleName, validateDisconnectionTicketDraft } from '../../shared/disconnectionTicketRules';
import { createApp } from '../src/app';
import type { Env } from '../src/env';
import { clearGuildRoleNamesForTests } from '../src/siteAuth/discordGuildRoles';
import { clearSiteMembersForTests } from '../src/siteAuth/siteDiscordAuth';
import { createTestEnv, getPath, MEMBERSHIPS, REQUIRED_DETAILS, sendJson } from './support/testApp';

const SITE = 'https://race-control-api.test';
const VEZ_ROLE = '1571641908688588963';
const VEZ_CHANNEL = '1571641908688588999';

/** Ruoli del server letti dal bot: equipaggi "#numero nome" e altri ruoli. */
const GUILD_ROLES = [
  { id: VEZ_ROLE, name: '#16 Vez Team Lime' },
  { id: 'role-44', name: '#44 Firestarter Project' },
  { id: 'role-99', name: '#99 Fuori campionato' },
  { id: 'role-director', name: 'Direttore Gara' },
  { id: 'role-pilot', name: 'Pilota' },
];

/** Utenti del sito: ID Discord, nome e ruoli nel server. */
const SITE_USERS: Record<string, { id: string; username: string; global_name: string; roles: string[] }> = {
  'Bearer site-vez': { id: '111', username: 'niko_rc', global_name: 'Niko', roles: [VEZ_ROLE, 'role-pilot'] },
  'Bearer site-vez-2': { id: '222', username: 'luca', global_name: 'Luca', roles: [VEZ_ROLE] },
  'Bearer site-no-crew': { id: '333', username: 'ale', global_name: 'Ale', roles: ['role-pilot'] },
  'Bearer site-two-crews': { id: '444', username: 'max', global_name: 'Max', roles: [VEZ_ROLE, 'role-44'] },
  'Bearer site-no-championship': { id: '555', username: 'eva', global_name: 'Eva', roles: ['role-99'] },
};

describe('ticket di disconnessione', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createApp>;
  let isBotWorking: boolean;
  let botCalls: number;
  /** Messaggi scritti dal bot nei canali; channelStatus decide la risposta di Discord. */
  let channelMessages: { channelId: string; authorization: string | null; body: { content: string; allowed_mentions: unknown } }[];
  let channelStatus: number;

  const discordFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get('Authorization');
    const channelMatch = /\/channels\/(\d+)\/messages$/.exec(url);
    if (channelMatch?.[1] && init?.method === 'POST') {
      channelMessages.push({ channelId: channelMatch[1], authorization, body: JSON.parse(String(init.body)) });
      return new Response('{}', { status: channelStatus });
    }
    if (url.endsWith('/guilds/guild-1/roles')) {
      botCalls += 1;
      if (!isBotWorking || authorization !== 'Bot bot-token') return new Response('{}', { status: 403 });
      return new Response(JSON.stringify(GUILD_ROLES), { status: 200 });
    }
    const user = authorization ? SITE_USERS[authorization] : undefined;
    if (user) return new Response(JSON.stringify({ nick: null, roles: user.roles, user: { ...user, avatar: null } }), { status: 200 });
    if (authorization === 'Bearer site-outsider') return new Response('{}', { status: 404 });
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
  const submit = (body: unknown, token = 'site-vez') => siteRequest('POST', '/public/disconnection-tickets', token, body);
  const report = (overrides: Record<string, unknown> = {}) => ({ position: 3, gapMs: 83_456, disconnectedOnLap: 12, ...overrides });
  const details = (overrides: Record<string, unknown> = {}) => ({
    position: 'chasing',
    missingLaps: 18,
    penaltySeconds: 126.274,
    gapSeconds: 83.456,
    pitStallEntrySeconds: 9,
    totalWaitSeconds: 209.73,
    trackLengthKm: 5.793,
    driveThroughSeconds: 22,
    stintTotalLaps: 29,
    ...overrides,
  });
  const sendResult = (ticketId: number, body: unknown, token = 'token-director') =>
    handleRequest(sendJson('POST', `/disconnection-tickets/${ticketId}/result`, body, token), env);

  beforeEach(async () => {
    clearGuildRoleNamesForTests();
    clearSiteMembersForTests();
    isBotWorking = true;
    botCalls = 0;
    channelMessages = [];
    channelStatus = 200;
    env = { ...createTestEnv(), DISCORD_BOT_TOKEN: 'bot-token' };
    handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }), discordFetch);
    await handleRequest(sendJson('POST', '/crews', { name: 'Vez Team Lime', number: 16, carId: 1, ...REQUIRED_DETAILS, discordChannelId: VEZ_CHANNEL }, 'token-director'), env);
    await handleRequest(sendJson('POST', '/crews', { name: 'Firestarter Project', number: 44, carId: 1, ...REQUIRED_DETAILS }, 'token-director'), env);
    await handleRequest(sendJson('POST', '/crews', { name: 'Fuori campionato', number: 99, carId: 1, championship: 'None', color: '#000000' }, 'token-director'), env);
  });

  it('riconosce i ruoli di equipaggio dal nome "#numero …"', () => {
    expect(crewNumberFromRoleName('#16 Vez Team Lime')).toBe(16);
    expect(crewNumberFromRoleName('# 7 Team')).toBe(7);
    expect(crewNumberFromRoleName('#120')).toBe(120);
    expect(crewNumberFromRoleName('Direttore Gara')).toBeNull();
    expect(crewNumberFromRoleName('Team #16')).toBeNull();
    expect(crewNumberFromRoleName('#16x')).toBeNull();
  });

  it('il sito legge l’equipaggio dal ruolo Discord di chi è entrato, con i nomi dei ruoli letti dal bot', async () => {
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-vez')).toEqual({
      status: 200,
      body: { crew: { id: 1, number: 16, name: 'Vez Team Lime', championship: 'Cool1 FIE Championship' } },
    });
    // I nomi dei ruoli restano in memoria: la seconda volta il bot non viene richiamato.
    await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-vez-2');
    expect(botCalls).toBe(1);
  });

  it('con il ruolo collegato nella scheda dell’equipaggio non serve il nome del ruolo né il bot', async () => {
    await env.CREWS_DB.prepare('UPDATE crews SET discord_role_id = ? WHERE number = 16').bind(VEZ_ROLE).run();
    clearGuildRoleNamesForTests();
    isBotWorking = false;
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-vez')).toEqual({
      status: 200,
      body: { crew: { id: 1, number: 16, name: 'Vez Team Lime', championship: 'Cool1 FIE Championship' } },
    });
    expect(botCalls).toBe(0);
    // Il ruolo collegato vale da solo: un altro ruolo "#N" senza equipaggio collegato non crea ambiguità.
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-two-crews')).toMatchObject({ status: 200, body: { crew: { number: 16 } } });
    // Il ticket ricorda il ruolo collegato, che il bot menzionerà con il risultato.
    expect((await submit(report(), 'site-vez')).status).toBe(201);
    expect(await env.CREWS_DB.prepare('SELECT crew_role_id AS crewRoleId FROM disconnection_tickets').first()).toEqual({ crewRoleId: VEZ_ROLE });
  });

  it('un equipaggio con un altro ruolo collegato non si riconosce più dal nome "#N"', async () => {
    await env.CREWS_DB.prepare("UPDATE crews SET discord_role_id = '1571641908688500000' WHERE number = 16").run();
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-vez')).toMatchObject({ status: 422, body: { error: { code: 'crew-not-found' } } });
  });

  it('spiega perché non trova l’equipaggio', async () => {
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-no-crew')).toMatchObject({ status: 422, body: { error: { code: 'no-crew-role' } } });
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-two-crews')).toMatchObject({ status: 422, body: { error: { code: 'multiple-crew-roles' } } });
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-no-championship')).toMatchObject({ status: 422, body: { error: { code: 'crew-not-found' } } });
    clearGuildRoleNamesForTests();
    clearSiteMembersForTests();
    isBotWorking = false;
    expect(await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-vez')).toMatchObject({ status: 503, body: { error: { code: 'bot-unavailable' } } });
    // Senza token del bot configurato.
    clearGuildRoleNamesForTests();
    clearSiteMembersForTests();
    isBotWorking = true;
    env = { ...env, DISCORD_BOT_TOKEN: undefined };
    expect((await siteRequest('GET', '/public/disconnection-tickets/crew', 'site-vez')).status).toBe(503);
  });

  it('il ticket prende l’equipaggio dal ruolo (non da ciò che manda il sito); l’app lo chiude con il dettaglio del calcolo', async () => {
    expect(await submit({ ...report(), crewId: 2 })).toEqual({ status: 201, body: { ticket: { id: 1 } } });

    const listed = await handleRequest(getPath('/disconnection-tickets', 'token-director'), env);
    expect(await listed.json()).toMatchObject({
      tickets: [{ id: 1, crewId: 1, crewNumber: 16, crewName: 'Vez Team Lime', position: 3, gapMs: 83_456, disconnectedOnLap: 12, submittedByName: 'Niko', submittedByUsername: 'niko_rc' }],
    });
    expect(await siteRequest('GET', '/public/disconnection-tickets/1', 'site-vez')).toMatchObject({ status: 200, body: { ticket: { id: 1, status: 'open', result: null } } });

    const resolved = await sendResult(1, { details: details() });
    expect(resolved.status).toBe(200);
    expect(await resolved.json()).toEqual({ discordMessage: 'sent' });
    expect(await (await handleRequest(getPath('/disconnection-tickets', 'token-director'), env)).json()).toEqual({ tickets: [] });
    const mine = await siteRequest('GET', '/public/disconnection-tickets/mine', 'site-vez');
    expect(mine.body).toMatchObject({ tickets: [{ id: 1, status: 'resolved', result: details() }] });
    expect(typeof (mine.body.tickets as { resolvedAt: string }[])[0]?.resolvedAt).toBe('string');
    const stored = await env.CREWS_DB.prepare('SELECT waiting_time_ms AS waitingTimeMs, resolved_by_discord_id AS resolvedBy FROM disconnection_tickets').first();
    expect(stored).toEqual({ waitingTimeMs: 209_730, resolvedBy: 'discord-42' });

    expect((await sendResult(1, { details: details() })).status).toBe(409);
    expect((await sendResult(9, { details: details() })).status).toBe(404);
  });

  it('dopo il risultato il bot scrive nel canale dell’equipaggio menzionando solo il suo ruolo', async () => {
    await submit(report());
    await sendResult(1, { details: details() });
    expect(channelMessages).toHaveLength(1);
    const [message] = channelMessages;
    expect(message?.channelId).toBe(VEZ_CHANNEL);
    expect(message?.authorization).toBe('Bot bot-token');
    expect(message?.body.allowed_mentions).toEqual({ parse: [], roles: [VEZ_ROLE] });
    const url = `${SITE}/ticket-disconnessione/1`;
    expect(message?.body.content).toBe(
      [
        `Il ticket di disconnessione #1 è stato esaminato dalla Direzione Gara: il tempo di attesa stabilito è di **3 minuti e 29 secondi**. I dettagli completi sono disponibili nella pagina del ticket sul sito: <${url}>`,
        `Disconnection ticket #1 has been reviewed by Race Control: the waiting time is **3 minutes and 29 seconds**. Full details are available on the ticket page on the site: <${url}>`,
        `<@&${VEZ_ROLE}>`,
      ].join('\n\n'),
    );
  });

  it('equipaggio senza canale o bot che non può scrivere: il risultato si salva lo stesso e l’app lo sa', async () => {
    await submit(report(), 'site-vez');
    await env.CREWS_DB.prepare('UPDATE crews SET discord_channel_id = NULL WHERE number = 16').run();
    expect(await (await sendResult(1, { details: details() })).json()).toEqual({ discordMessage: 'no-channel' });
    expect(channelMessages).toHaveLength(0);

    await env.CREWS_DB.prepare('UPDATE crews SET discord_channel_id = ? WHERE number = 16').bind(VEZ_CHANNEL).run();
    await submit(report(), 'site-vez');
    channelStatus = 403;
    expect(await (await sendResult(2, { details: details({ totalWaitSeconds: 0 }) })).json()).toEqual({ discordMessage: 'failed' });
    expect(channelMessages[0]?.body.content).toContain('non è previsto alcun tempo di attesa e il rientro in pista è consentito immediatamente.');
    expect(channelMessages[0]?.body.content).toContain('no waiting time applies and rejoining the track is permitted immediately.');
    const statuses = await env.CREWS_DB.prepare("SELECT status FROM disconnection_tickets ORDER BY id").all<{ status: string }>();
    expect(statuses.results.map((row) => row.status)).toEqual(['resolved', 'resolved']);
  });

  it('il ticket è visibile a chi l’ha mandato e a chi ha lo stesso ruolo di equipaggio, non agli altri', async () => {
    await submit(report());
    await sendResult(1, { details: details() });
    const teammateTicket = await siteRequest('GET', '/public/disconnection-tickets/1', 'site-vez-2');
    expect(teammateTicket).toMatchObject({ status: 200, body: { ticket: { id: 1, status: 'resolved', result: details(), submittedByName: 'Niko' } } });
    expect(await siteRequest('GET', '/public/disconnection-tickets/mine', 'site-vez-2')).toMatchObject({ status: 200, body: { tickets: [{ id: 1 }] } });

    expect((await siteRequest('GET', '/public/disconnection-tickets/1', 'site-no-crew')).status).toBe(404);
    expect(await siteRequest('GET', '/public/disconnection-tickets/mine', 'site-no-crew')).toEqual({ status: 200, body: { tickets: [] } });
    expect((await siteRequest('GET', '/public/disconnection-tickets/mine', '')).status).toBe(401);
  });

  it('i ticket mandati prima che si salvasse il ruolo restano visibili solo a chi li ha mandati', async () => {
    await submit(report());
    await env.CREWS_DB.prepare('UPDATE disconnection_tickets SET crew_role_id = NULL').run();
    expect((await siteRequest('GET', '/public/disconnection-tickets/1', 'site-vez-2')).status).toBe(404);
    expect((await siteRequest('GET', '/public/disconnection-tickets/1', 'site-vez')).status).toBe(200);
  });

  it('senza ruolo di equipaggio il ticket non si manda', async () => {
    expect(await submit(report(), 'site-no-crew')).toMatchObject({ status: 422, body: { error: { code: 'no-crew-role' } } });
  });

  it('serve l’accesso Discord e far parte del server; nell’app serve il ruolo Direttore Gara', async () => {
    expect((await submit(report(), '')).status).toBe(401);
    expect((await submit(report(), 'site-outsider')).status).toBe(403);
    expect((await handleRequest(getPath('/disconnection-tickets'), env)).status).toBe(401);
    expect((await handleRequest(getPath('/disconnection-tickets', 'token-no-role'), env)).status).toBe(403);
    expect((await sendResult(1, { details: details() }, 'token-no-role')).status).toBe(403);
  });

  it('convalida posizione 1–14, distacco e giro', async () => {
    expect(await submit({})).toMatchObject({
      status: 422,
      body: { error: { code: 'invalid-ticket', details: { position: 'required', gapMs: 'required', disconnectedOnLap: 'required' } } },
    });
    expect(await submit(report({ position: 15, gapMs: -1, disconnectedOnLap: 2.5 }))).toMatchObject({
      status: 422,
      body: { error: { details: { position: 'out-of-range', gapMs: 'invalid', disconnectedOnLap: 'out-of-range' } } },
    });
    expect(validateDisconnectionTicketDraft(report({ position: 1, gapMs: 0, disconnectedOnLap: 0 }))).toMatchObject({ isValid: true });
  });

  it('al massimo 3 ticket aperti per persona', async () => {
    for (let index = 0; index < 3; index += 1) expect((await submit(report())).status).toBe(201);
    expect(await submit(report())).toMatchObject({ status: 429, body: { error: { code: 'too-many-tickets' } } });
    expect((await submit(report(), 'site-vez-2')).status).toBe(201);
    await sendResult(1, { details: details() });
    expect((await submit(report())).status).toBe(201);
  });

  it('rifiuta un dettaglio del calcolo non valido', async () => {
    await submit(report());
    for (const body of [{}, { waitingTimeMs: 1000 }, { details: details({ position: 'p3' }) }, { details: details({ missingLaps: 'tanti' }) }, { details: details({ penaltySeconds: Number.NaN }) }]) {
      expect((await sendResult(1, body)).status).toBe(422);
    }
  });
});

describe('messaggio del bot', () => {
  it('singolari e plurali, solo minuti o solo secondi', async () => {
    const { ticketResultMessage } = await import('../src/tickets/ticketResultNotice');
    const target = { id: 5, crewNumber: 16, crewName: 'Vez', position: 3, gapMs: 0, disconnectedOnLap: 1, crewRoleId: null, discordChannelId: '1' };
    const message = (totalWaitSeconds: number) =>
      ticketResultMessage(target, { position: 'chasing', missingLaps: 1, penaltySeconds: 1, gapSeconds: 0, pitStallEntrySeconds: 0, totalWaitSeconds, trackLengthKm: 5, driveThroughSeconds: 22, stintTotalLaps: 29 }, 'https://x.test/ticket-disconnessione/5');
    expect(message(61.9)).toContain('**1 minuto e 1 secondo**');
    expect(message(61.9)).toContain('**1 minute and 1 second**');
    expect(message(120)).toContain('**2 minuti**');
    expect(message(40)).toContain('**40 seconds**');
    expect(message(40).split('\n\n')).toHaveLength(2);
  });
});
