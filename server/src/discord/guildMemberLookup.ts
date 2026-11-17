import { describeDiscordFailure, fetchWithDiscordRetry, MEMBER_READ_RETRY } from './discordRateLimit';

/**
 * Chi è l'utente di un token Discord e quali ruoli ha nel server della lega, letti senza consumare il limite
 * stretto di /users/@me/guilds/{server}/member (limite per utente, condiviso da app e sito: superato, Discord
 * risponde 429 per diversi secondi e l'accesso fallisce):
 *   1. /users/@me con il token dell'utente: verifica il token e dà l'ID (limiti larghi);
 *   2. /guilds/{server}/members/{utente} con il bot "Michael Masi": ruoli e soprannome (limiti del bot, separati
 *      da quelli dell'utente; basta che il bot sia nel server, nessun intent privilegiato). I ruoli restano in
 *      memoria un minuto per utente, e fino a 10 minuti se poi Discord non risponde.
 * Senza bot configurato, o se il bot non può leggere il membro, si usa /users/@me/guilds/{server}/member come prima.
 */

const DISCORD_API_URL = 'https://discord.com/api/v10';
const MEMBER_ROLES_FRESH_MS = 60 * 1000;
const MEMBER_ROLES_STALE_MS = 10 * 60 * 1000;

export interface DiscordUser {
  readonly id: string;
  readonly username: string;
  readonly global_name?: string | null;
  readonly avatar?: string | null;
}

export type GuildMemberLookup =
  | { readonly status: 'member'; readonly user: DiscordUser; readonly nick: string | null; readonly roles: readonly string[] }
  | { readonly status: 'invalid-token' }
  | { readonly status: 'not-member' }
  | { readonly status: 'unavailable' };

export interface GuildMemberLookupSettings {
  readonly guildId: string;
  /** Token del bot (DISCORD_BOT_TOKEN); senza, si legge il membro con il token dell'utente. */
  readonly botToken?: string;
}

interface DiscordMemberBody {
  readonly nick?: string | null;
  readonly roles?: readonly string[];
  readonly user?: Partial<DiscordUser>;
}

const isDiscordUser = (value: unknown): value is DiscordUser =>
  typeof value === 'object' && value !== null && typeof (value as DiscordUser).id === 'string' && typeof (value as DiscordUser).username === 'string';

const memberRoles = new Map<string, { readonly nick: string | null; readonly roles: readonly string[]; readonly fetchedAt: number }>();

/** Solo per i test. */
export function clearMemberRolesForTests() {
  memberRoles.clear();
}

async function read(discordFetch: typeof fetch, path: string, authorization: string): Promise<Response | null> {
  try {
    return await fetchWithDiscordRetry(discordFetch, `${DISCORD_API_URL}${path}`, { headers: { Authorization: authorization } }, MEMBER_READ_RETRY);
  } catch {
    console.warn(`Discord non raggiungibile su ${path.replace(/\d{5,}/g, ':id')}`);
    return null;
  }
}

/** Metodo di prima: profilo e ruoli con il token dell'utente (limite stretto per utente). */
async function lookupWithUserToken(discordFetch: typeof fetch, guildId: string, accessToken: string): Promise<GuildMemberLookup> {
  const response = await read(discordFetch, `/users/@me/guilds/${guildId}/member`, `Bearer ${accessToken}`);
  if (!response) return { status: 'unavailable' };
  if (response.status === 401) return { status: 'invalid-token' };
  if (response.status === 404 || response.status === 403) return { status: 'not-member' };
  if (!response.ok) {
    console.warn(describeDiscordFailure(response, '/users/@me/guilds/:server/member'));
    return { status: 'unavailable' };
  }
  const member = (await response.json().catch(() => null)) as DiscordMemberBody | null;
  if (!isDiscordUser(member?.user)) {
    console.warn('Discord ha risposto senza i dati dell’utente su /users/@me/guilds/:server/member');
    return { status: 'unavailable' };
  }
  return { status: 'member', user: member.user, nick: member.nick ?? null, roles: member.roles ?? [] };
}

/** Ruoli e soprannome letti dal bot; null se il bot non li può leggere (si torna al metodo di prima). */
async function lookupRolesWithBot(
  discordFetch: typeof fetch,
  guildId: string,
  botToken: string,
  userId: string,
): Promise<{ readonly nick: string | null; readonly roles: readonly string[] } | 'not-member' | null> {
  const cacheKey = `${guildId}:${userId}`;
  const cached = memberRoles.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < MEMBER_ROLES_FRESH_MS) return cached;

  const response = await read(discordFetch, `/guilds/${guildId}/members/${userId}`, `Bot ${botToken}`);
  if (response?.status === 404) {
    memberRoles.delete(cacheKey);
    return 'not-member';
  }
  if (!response?.ok) {
    if (response) console.warn(`${describeDiscordFailure(response, '/guilds/:server/members/:id')} (bot)`);
    return cached && Date.now() - cached.fetchedAt < MEMBER_ROLES_STALE_MS ? cached : null;
  }
  const member = (await response.json().catch(() => null)) as DiscordMemberBody | null;
  if (!member) return null;
  const entry = { nick: member.nick ?? null, roles: member.roles ?? [], fetchedAt: Date.now() };
  if (memberRoles.size > 500) memberRoles.clear();
  memberRoles.set(cacheKey, entry);
  return entry;
}

export async function lookupGuildMember(discordFetch: typeof fetch, { guildId, botToken }: GuildMemberLookupSettings, accessToken: string): Promise<GuildMemberLookup> {
  if (!botToken) return lookupWithUserToken(discordFetch, guildId, accessToken);

  const userResponse = await read(discordFetch, '/users/@me', `Bearer ${accessToken}`);
  if (userResponse?.status === 401) return { status: 'invalid-token' };
  const user = userResponse?.ok ? ((await userResponse.json().catch(() => null)) as unknown) : null;
  if (!isDiscordUser(user)) {
    if (userResponse && !userResponse.ok) console.warn(describeDiscordFailure(userResponse, '/users/@me'));
    return lookupWithUserToken(discordFetch, guildId, accessToken);
  }

  const roles = await lookupRolesWithBot(discordFetch, guildId, botToken, user.id);
  if (roles === 'not-member') return { status: 'not-member' };
  if (!roles) return lookupWithUserToken(discordFetch, guildId, accessToken);
  return { status: 'member', user, nick: roles.nick, roles: roles.roles };
}
