import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { clearMemberRolesForTests, lookupGuildMember } from '../src/discord/guildMemberLookup';
import { clearSiteMembersForTests } from '../src/siteAuth/siteDiscordAuth';
import { asOurApplication, createTestEnv } from './support/testApp';

const USER = { id: '80351110224678912', username: 'niko_rc', global_name: 'Niko', avatar: null };
const SETTINGS = { applicationId: 'site-app-1', guildId: 'guild-1', botToken: 'bot-token' };

/**
 * Discord simulato come nei log di produzione: /users/@me/guilds/{server}/member risponde 429 (limite per utente),
 * mentre /users/@me e la lettura del membro da parte del bot funzionano. Conta le chiamate per percorso.
 */
function discordWithUserLimitReached(options: { botStatus?: number; userStatus?: number } = {}) {
  const calls: string[] = [];
  const discordFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get('Authorization');
    calls.push(url.replace('https://discord.com/api/v10', ''));
    if (url.endsWith('/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 604800 }), { status: 200 });
    }
    if (url.endsWith('/users/@me/guilds/guild-1/member')) {
      return new Response(JSON.stringify({ message: 'You are being rate limited.', retry_after: 12.5, global: false }), {
        status: 429,
        headers: { 'X-RateLimit-Scope': 'user' },
      });
    }
    if (url.endsWith('/users/@me')) {
      if (authorization !== 'Bearer access-1') return new Response('{}', { status: 401 });
      return new Response(JSON.stringify(USER), { status: options.userStatus ?? 200 });
    }
    if (url.endsWith(`/guilds/guild-1/members/${USER.id}`)) {
      if (authorization !== 'Bot bot-token') return new Response('{}', { status: 401 });
      const botStatus = options.botStatus ?? 200;
      return new Response(JSON.stringify({ nick: 'Niko RC', roles: ['role-16'], user: USER }), { status: botStatus });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { calls, discordFetch: asOurApplication(discordFetch, 'site-app-1') };
}

describe('profilo e ruoli senza il limite stretto per utente', () => {
  beforeEach(() => {
    clearMemberRolesForTests();
    clearSiteMembersForTests();
  });

  it('identifica l’utente con /users/@me e legge i ruoli con il bot, una volta al minuto per utente', async () => {
    const discord = discordWithUserLimitReached();
    expect(await lookupGuildMember(discord.discordFetch, SETTINGS, 'access-1')).toEqual({ status: 'member', user: USER, nick: 'Niko RC', roles: ['role-16'] });
    expect(discord.calls).toEqual(['/users/@me', `/guilds/guild-1/members/${USER.id}`]);
    await lookupGuildMember(discord.discordFetch, SETTINGS, 'access-1');
    expect(discord.calls.filter((path) => path.includes('/members/'))).toHaveLength(1);
  });

  it('token non valido, utente fuori dal server e bot che non può leggere', async () => {
    const discord = discordWithUserLimitReached();
    expect(await lookupGuildMember(discord.discordFetch, SETTINGS, 'scaduto')).toEqual({ status: 'invalid-token' });
    expect(await lookupGuildMember(discordWithUserLimitReached({ botStatus: 404 }).discordFetch, SETTINGS, 'access-1')).toEqual({ status: 'not-member' });
    // Bot senza accesso: si torna al metodo di prima, che qui risponde 429.
    expect(await lookupGuildMember(discordWithUserLimitReached({ botStatus: 403 }).discordFetch, SETTINGS, 'access-1')).toEqual({ status: 'unavailable' });
    // Senza bot configurato si usa direttamente il metodo di prima.
    const withoutBot = discordWithUserLimitReached();
    expect(await lookupGuildMember(withoutBot.discordFetch, { applicationId: 'site-app-1', guildId: 'guild-1' }, 'access-1')).toEqual({ status: 'unavailable' });
    expect(withoutBot.calls).toEqual(['/users/@me/guilds/guild-1/member']);
  });

  it('l’accesso al sito riesce anche quando Discord limita la lettura dei ruoli con il token dell’utente', async () => {
    const discord = discordWithUserLimitReached();
    const env = { ...createTestEnv(), DISCORD_BOT_TOKEN: 'bot-token' };
    const handleRequest = createApp(undefined, discord.discordFetch);
    const response = await handleRequest(
      new Request('https://race-control-api.test/public/discord/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://race-control-api.test' },
        body: JSON.stringify({ code: 'code-1', codeVerifier: 'verifier', redirectUri: 'https://race-control-api.test/accesso/discord' }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessToken: 'access-1', profile: { id: USER.id, username: 'niko_rc', displayName: 'Niko RC' } });
    expect(discord.calls).not.toContain('/users/@me/guilds/guild-1/member');
  });
});
