import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { checkDiscordMembership, clearVerifiedMembershipsForTests } from '../src/auth/discordMembership';
import { clearMemberRolesForTests } from '../src/discord/guildMemberLookup';
import { checkTokenApplication } from '../src/discord/tokenApplication';
import { clearSiteMembersForTests } from '../src/siteAuth/siteDiscordAuth';
import { createTestEnv } from './support/testApp';

const USER = { id: '80351110224678912', username: 'niko_rc' };

/**
 * Discord simulato: il token "token-ours" è della nostra applicazione, "token-foreign" di un'altra applicazione,
 * "token-few-scopes" della nostra ma senza guilds.members.read, "token-site" dell'applicazione del sito. Per tutti la lettura del membro andrebbe a buon fine
 * con il ruolo Organizzazione: se il controllo mancasse, entrerebbero tutti.
 */
function discord(oauthStatus = 200) {
  const calls: string[] = [];
  const discordFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input).replace('https://discord.com/api/v10', '');
    const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '');
    calls.push(url);
    if (url === '/oauth2/@me') {
      if (oauthStatus !== 200) return new Response('{}', { status: oauthStatus });
      const application = token === 'token-foreign' ? 'app-altra' : token === 'token-site' ? 'site-app-1' : 'app-1';
      const scopes = token === 'token-few-scopes' ? ['identify'] : ['identify', 'guilds.members.read'];
      return new Response(JSON.stringify({ application: { id: application }, scopes, user: USER }), { status: 200 });
    }
    if (url === '/users/@me/guilds/guild-1/member') return new Response(JSON.stringify({ nick: null, roles: ['role-organization'], user: USER }), { status: 200 });
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { calls, discordFetch };
}

const SETTINGS = { applicationId: 'app-1', guildId: 'guild-1', organizationRoleId: 'role-organization', raceControlRoleId: 'role-race-control', stewardsRoleId: 'role-stewards' };

describe('solo i token della nostra applicazione Discord', () => {
  afterEach(() => {
    clearVerifiedMembershipsForTests();
    clearMemberRolesForTests();
    clearSiteMembersForTests();
    vi.restoreAllMocks();
  });

  it('riconosce applicazione e scope del token', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { discordFetch } = discord();
    expect(await checkTokenApplication(discordFetch, 'app-1', 'token-ours')).toBe('ours');
    expect(await checkTokenApplication(discordFetch, 'app-1', 'token-foreign')).toBe('foreign');
    expect(await checkTokenApplication(discordFetch, 'app-1', 'token-few-scopes')).toBe('foreign');
    expect(await checkTokenApplication(discord(401).discordFetch, 'app-1', 'token-ours')).toBe('invalid-token');
    expect(await checkTokenApplication(discord(500).discordFetch, 'app-1', 'token-ours')).toBe('unavailable');
  });

  it("app: un token di un'altra applicazione non entra, anche se l'utente ha il ruolo; quello nostro sì", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const foreign = discord();
    expect(await checkDiscordMembership('token-foreign', SETTINGS, foreign.discordFetch)).toEqual({ status: 'invalid-token' });
    // Rifiutato prima di leggere i ruoli.
    expect(foreign.calls).toEqual(['/oauth2/@me']);
    expect(await checkDiscordMembership('token-few-scopes', SETTINGS, discord().discordFetch)).toEqual({ status: 'invalid-token' });
    expect(await checkDiscordMembership('token-ours', SETTINGS, discord().discordFetch)).toMatchObject({ status: 'member-with-role', access: { organization: true } });
    expect(await checkDiscordMembership('token-down', SETTINGS, discord(503).discordFetch)).toEqual({ status: 'discord-unavailable' });
  });

  it('app e sito hanno applicazioni separate: il token del sito non vale per l’app, quello dell’app non vale per il sito', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Un pilota (o chi gli ha rubato il token dal browser) non entra negli strumenti degli ufficiali, anche con il ruolo.
    expect(await checkDiscordMembership('token-site', SETTINGS, discord().discordFetch)).toEqual({ status: 'invalid-token' });

    const handleRequest = createApp(undefined, discord().discordFetch);
    const profile = (token: string) => handleRequest(new Request('https://race-control-api.test/public/discord/me', { headers: { Authorization: `Bearer ${token}` } }), createTestEnv());
    expect((await profile('token-site')).status).toBe(200);
    expect((await profile('token-ours')).status).toBe(401);
    expect((await profile('token-foreign')).status).toBe(401);
  });
});
