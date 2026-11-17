import { createApp } from '../../src/app';
import type { MembershipCheck } from '../../src/auth/discordMembership';
import type { Env } from '../../src/env';
import { createInMemorySqlDatabase } from './inMemorySqlDatabase';

/** Strumenti comuni ai test delle API: ambiente con SQLite in memoria e verifica Discord simulata. */

export function createTestEnv(): Env {
  return {
    CREWS_DB: createInMemorySqlDatabase(),
    DISCORD_APPLICATION_ID: 'app-1',
    DISCORD_GUILD_ID: 'guild-1',
    DISCORD_ORGANIZATION_ROLE_ID: 'role-organization',
    DISCORD_REQUIRED_ROLE_ID: 'role-race-control',
    DISCORD_STEWARDS_ROLE_ID: 'role-stewards',
  };
}

export const MEMBERSHIPS: Record<string, MembershipCheck> = {
  // Organizzazione, Direttore Gara e Commissario insieme: può usare tutto.
  'token-director': { status: 'member-with-role', discordUserId: 'discord-42', access: { organization: true, raceControl: true, stewards: true } },
  'token-organization': { status: 'member-with-role', discordUserId: 'discord-45', access: { organization: true, raceControl: false, stewards: false } },
  'token-race-control': { status: 'member-with-role', discordUserId: 'discord-43', access: { organization: false, raceControl: true, stewards: false } },
  'token-steward': { status: 'member-with-role', discordUserId: 'discord-44', access: { organization: false, raceControl: false, stewards: true } },
  'token-no-role': { status: 'missing-role' },
  'token-discord-down': { status: 'discord-unavailable' },
};

/** App con la verifica Discord simulata: ogni token corrisponde a un esito. */
export function createTestApp(membershipByToken: Record<string, MembershipCheck> = MEMBERSHIPS) {
  return createApp((accessToken) => Promise.resolve(membershipByToken[accessToken] ?? { status: 'invalid-token' }));
}

export const authorizationHeader = (accessToken?: string): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {});

export function sendJson(method: 'POST' | 'PUT' | 'DELETE', path: string, body: unknown, accessToken?: string) {
  return new Request(`https://race-control-api.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authorizationHeader(accessToken) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export const getPath = (path: string, accessToken?: string) =>
  new Request(`https://race-control-api.test${path}`, { headers: authorizationHeader(accessToken) });

export async function readError(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

/** Campionato e colore validi, obbligatori come l'auto. */
export const REQUIRED_DETAILS = { championship: 'Cool1 FIE Championship', color: '#E10600' } as const;
