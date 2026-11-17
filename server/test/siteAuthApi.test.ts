import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { clearSiteMembersForTests } from '../src/siteAuth/siteDiscordAuth';
import type { Env } from '../src/env';
import { createTestEnv } from './support/testApp';

/**
 * Discord simulato: codici e token di rinnovo noti danno token; il token di accesso decide l'esito della verifica
 * sul server (membro, non membro, scaduto). Registra le chiamate.
 */
function fakeDiscord() {
  const calls: { url: string; body: string; authorization: string | null }[] = [];
  const tokensFor = (accessToken: string) =>
    new Response(JSON.stringify({ access_token: accessToken, refresh_token: `refresh-${accessToken}`, expires_in: 604800 }), { status: 200 });
  const discordFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const body = String(init?.body ?? '');
    const authorization = new Headers(init?.headers).get('Authorization');
    calls.push({ url, body, authorization });
    const form = new URLSearchParams(body);
    if (url.endsWith('/oauth2/token')) {
      if (form.get('code') === 'code-member') return tokensFor('access-member');
      if (form.get('code') === 'code-outsider') return tokensFor('access-outsider');
      if (form.get('refresh_token') === 'refresh-access-member') return tokensFor('access-member-2');
      return new Response('{"error":"invalid_grant"}', { status: 400 });
    }
    if (url.endsWith('/oauth2/token/revoke')) return new Response(null, { status: 200 });
    if (url.endsWith('/users/@me/guilds/guild-1/member')) {
      if (authorization === 'Bearer access-member' || authorization === 'Bearer access-member-2') {
        return new Response(JSON.stringify({ nick: null, roles: [], user: { id: '80351110224678912', username: 'niko_rc', global_name: 'Niko', avatar: null } }), { status: 200 });
      }
      if (authorization === 'Bearer access-outsider') return new Response('{}', { status: 404 });
      return new Response('{}', { status: 401 });
    }
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  return { calls, discordFetch };
}

const SITE = 'https://race-control-api.test';

function post(path: string, body: unknown, origin = SITE) {
  return new Request(`${SITE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
}

describe('accesso al sito con Discord', () => {
  let env: Env;
  let discord: ReturnType<typeof fakeDiscord>;
  let handleRequest: ReturnType<typeof createApp>;

  beforeEach(() => {
    clearSiteMembersForTests();
    env = createTestEnv();
    discord = fakeDiscord();
    handleRequest = createApp(undefined, discord.discordFetch);
  });

  it('scambia il codice (PKCE, senza segreto) e restituisce profilo e token a chi fa parte del server, anche senza ruoli', async () => {
    const response = await handleRequest(post('/public/discord/session', { code: 'code-member', codeVerifier: 'verifier', redirectUri: `${SITE}/accesso/discord` }), env);
    expect(response.status).toBe(200);
    const session = (await response.json()) as Record<string, unknown>;
    expect(session).toMatchObject({
      profile: { id: '80351110224678912', username: 'niko_rc', displayName: 'Niko' },
      accessToken: 'access-member',
      refreshToken: 'refresh-access-member',
    });
    expect((session.profile as { avatarUrl: string }).avatarUrl.startsWith('https://cdn.discordapp.com/embed/avatars/')).toBe(true);
    expect(typeof session.expiresAt).toBe('number');

    const tokenRequest = new URLSearchParams(discord.calls[0]?.body);
    expect(Object.fromEntries(tokenRequest)).toEqual({
      client_id: 'app-1',
      grant_type: 'authorization_code',
      code: 'code-member',
      redirect_uri: `${SITE}/accesso/discord`,
      code_verifier: 'verifier',
    });
    expect(tokenRequest.has('client_secret')).toBe(false);
  });

  it('se Discord limita le richieste o è in difficoltà per un momento, l’accesso riprova invece di fallire', async () => {
    const realFetch = discord.discordFetch;
    let tokenCalls = 0;
    let memberCalls = 0;
    const busyDiscord = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      // Primo scambio del codice: 429 con l'attesa indicata (Discord non l'ha eseguito, il codice vale ancora).
      if (url.endsWith('/oauth2/token') && (tokenCalls += 1) === 1) return new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 });
      // Prima lettura del profilo: 429 e poi 503 (si legge di nuovo, la lettura si può ripetere).
      if (url.endsWith('/member')) {
        memberCalls += 1;
        if (memberCalls === 1) return new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 });
      }
      return realFetch(input, init);
    }) as typeof fetch;
    handleRequest = createApp(undefined, busyDiscord);

    const response = await handleRequest(post('/public/discord/session', { code: 'code-member', codeVerifier: 'verifier', redirectUri: `${SITE}/accesso/discord` }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessToken: 'access-member', profile: { username: 'niko_rc' } });
    expect(tokenCalls).toBe(2);
    expect(memberCalls).toBe(2);
  });

  it('un errore del server di Discord nello scambio del codice non si ripete (il codice vale una volta sola)', async () => {
    let tokenCalls = 0;
    handleRequest = createApp(undefined, (async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith('/oauth2/token')) tokenCalls += 1;
      return new Response('{}', { status: 502 });
    }) as typeof fetch);
    const response = await handleRequest(post('/public/discord/session', { code: 'code-member', codeVerifier: 'verifier', redirectUri: `${SITE}/accesso/discord` }), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'discord-unavailable' } });
    expect(tokenCalls).toBe(1);
  });

  it('rifiuta chi non fa parte del server e revoca subito i suoi token', async () => {
    const response = await handleRequest(post('/public/discord/session', { code: 'code-outsider', codeVerifier: 'v', redirectUri: `${SITE}/accesso/discord` }), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'not-guild-member' } });
    expect(discord.calls.some((call) => call.url.endsWith('/oauth2/token/revoke') && call.body.includes('refresh-access-outsider'))).toBe(true);
  });

  it('accetta solo il ritorno sulla pagina del sito che ha avviato l’accesso', async () => {
    for (const redirectUri of ['https://evil.example/accesso/discord', `${SITE}/altro`, `${SITE}/accesso/discord?x=1`, 'non è un indirizzo']) {
      const response = await handleRequest(post('/public/discord/session', { code: 'code-member', codeVerifier: 'v', redirectUri }), env);
      expect(response.status).toBe(400);
    }
    // In sviluppo il sito è su localhost e la richiesta arriva dal proxy di Vite con Origin localhost.
    const fromDevSite = await handleRequest(
      post('/public/discord/session', { code: 'code-member', codeVerifier: 'v', redirectUri: 'http://localhost:5174/accesso/discord' }, 'http://localhost:5174'),
      env,
    );
    expect(fromDevSite.status).toBe(200);
    expect(discord.calls.filter((call) => call.url.endsWith('/oauth2/token'))).toHaveLength(1);
  });

  it('codice non valido o richiesta incompleta', async () => {
    expect((await handleRequest(post('/public/discord/session', { code: 'scaduto', codeVerifier: 'v', redirectUri: `${SITE}/accesso/discord` }), env)).status).toBe(401);
    expect((await handleRequest(post('/public/discord/session', { code: 'code-member' }), env)).status).toBe(400);
    expect((await handleRequest(new Request(`${SITE}/public/discord/session`), env)).status).toBe(405);
  });

  it('rinnova la sessione, legge il profilo e all’uscita revoca il token', async () => {
    const refreshed = await handleRequest(post('/public/discord/refresh', { refreshToken: 'refresh-access-member' }), env);
    expect(await refreshed.json()).toMatchObject({ accessToken: 'access-member-2', profile: { username: 'niko_rc' } });
    expect((await handleRequest(post('/public/discord/refresh', { refreshToken: 'vecchio' }), env)).status).toBe(401);

    const profile = await handleRequest(new Request(`${SITE}/public/discord/me`, { headers: { Authorization: 'Bearer access-member' } }), env);
    expect(await profile.json()).toMatchObject({ profile: { displayName: 'Niko', username: 'niko_rc' } });
    expect((await handleRequest(new Request(`${SITE}/public/discord/me`, { headers: { Authorization: 'Bearer scaduto' } }), env)).status).toBe(401);
    expect((await handleRequest(new Request(`${SITE}/public/discord/me`), env)).status).toBe(401);

    const signedOut = await handleRequest(post('/public/discord/sign-out', { refreshToken: 'refresh-access-member' }), env);
    expect(signedOut.status).toBe(204);
    expect(discord.calls.at(-1)?.url.endsWith('/oauth2/token/revoke')).toBe(true);
  });

  it('Discord non raggiungibile → 503', async () => {
    const offline = createApp(undefined, (() => Promise.reject(new Error('offline'))) as typeof fetch);
    const response = await offline(post('/public/discord/session', { code: 'code-member', codeVerifier: 'v', redirectUri: `${SITE}/accesso/discord` }), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'discord-unavailable' } });
  });

  it('richieste contemporanee con lo stesso token: una sola chiamata a Discord, poi il profilo resta in memoria', async () => {
    const me = () => handleRequest(new Request(`${SITE}/public/discord/me`, { headers: { Authorization: 'Bearer access-member' } }), env);
    const responses = await Promise.all([me(), me(), me(), me()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    expect((await me()).status).toBe(200);
    expect(discord.calls.filter((call) => call.url.endsWith('/member'))).toHaveLength(1);
  });

  it('Discord risponde 429 con un\'attesa breve: aspetta e riprova', async () => {
    let memberCalls = 0;
    const limited = createApp(undefined, (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input).endsWith('/member')) {
        memberCalls += 1;
        if (memberCalls === 1) return new Response(JSON.stringify({ retry_after: 0.05 }), { status: 429 });
      }
      return discord.discordFetch(input, init);
    }) as typeof fetch);
    const response = await limited(new Request(`${SITE}/public/discord/me`, { headers: { Authorization: 'Bearer access-member' } }), env);
    expect(response.status).toBe(200);
    expect(memberCalls).toBe(2);
  });

  it('Discord limita a lungo: se il profilo era già stato letto da poco vale quello, altrimenti 503', async () => {
    let isLimited = false;
    const app = createApp(undefined, (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (isLimited && String(input).endsWith('/member')) return new Response(JSON.stringify({ retry_after: 30 }), { status: 429 });
      return discord.discordFetch(input, init);
    }) as typeof fetch);
    const me = (token: string) => app(new Request(`${SITE}/public/discord/me`, { headers: { Authorization: `Bearer ${token}` } }), env);
    expect((await me('access-member')).status).toBe(200);
    isLimited = true;
    const realNow = Date.now;
    Date.now = () => realNow() + 2 * 60 * 1000;
    try {
      expect((await me('access-member')).status).toBe(200);
      expect((await me('access-member-2')).status).toBe(503);
    } finally {
      Date.now = realNow;
    }
  });
});
