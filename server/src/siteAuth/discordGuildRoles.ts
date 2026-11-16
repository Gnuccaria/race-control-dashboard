import type { Env } from '../env';
import { fetchWithDiscordRetry } from '../discord/discordRateLimit';
import type { DiscordFetch } from './siteDiscordAuth';

/**
 * Nomi dei ruoli del server Discord della lega, letti dal bot "Michael Masi" (token DISCORD_BOT_TOKEN, segreto
 * su Cloudflare). Con l'accesso dell'utente Discord dà solo gli ID dei suoi ruoli; i nomi (es. "#16 Vez Team
 * Lime") li può leggere solo un bot presente nel server. Nessun permesso speciale: basta che il bot sia nel server.
 * I nomi restano in memoria 5 minuti per non chiederli a ogni ticket.
 */

const DISCORD_API_URL = 'https://discord.com/api/v10';
const ROLE_NAMES_TTL_MS = 5 * 60 * 1000;

export type GuildRoleNames = ReadonlyMap<string, string>;

let cachedRoleNames: { readonly guildId: string; readonly names: GuildRoleNames; readonly expiresAt: number } | null = null;

/** ID ruolo → nome; null se il bot non è configurato, non è nel server o Discord non risponde. */
export async function fetchGuildRoleNames(discordFetch: DiscordFetch, env: Env): Promise<GuildRoleNames | null> {
  if (cachedRoleNames && cachedRoleNames.guildId === env.DISCORD_GUILD_ID && cachedRoleNames.expiresAt > Date.now()) return cachedRoleNames.names;
  if (!env.DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN mancante: impossibile leggere i ruoli del server Discord');
    return null;
  }
  let response: Response;
  try {
    response = await fetchWithDiscordRetry(discordFetch, `${DISCORD_API_URL}/guilds/${env.DISCORD_GUILD_ID}/roles`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    console.error(`Ruoli del server non leggibili dal bot (${response.status}): il bot è nel server e il token è giusto?`);
    return null;
  }
  const roles = (await response.json()) as { id: string; name: string }[];
  const names = new Map(roles.map((role) => [role.id, role.name] as const));
  cachedRoleNames = { guildId: env.DISCORD_GUILD_ID, names, expiresAt: Date.now() + ROLE_NAMES_TTL_MS };
  return names;
}

/** Solo per i test. */
export function clearGuildRoleNamesForTests() {
  cachedRoleNames = null;
}
