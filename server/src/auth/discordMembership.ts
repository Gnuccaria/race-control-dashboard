/**
 * Verifica lato server i ruoli dell'app di chi fa la richiesta nel server Discord: Organizzazione, Direzione Gara
 * e Commissari Sportivi. Serve almeno uno dei tre. È il controllo che conta davvero: l'app desktop potrebbe essere
 * manomessa, il server no.
 */

import { describeDiscordFailure, fetchWithDiscordRetry, hashToken, MEMBER_READ_RETRY } from '../discord/discordRateLimit';

const DISCORD_API_URL = 'https://discord.com/api/v10';
const VERIFIED_MEMBERSHIP_TTL_MS = 5 * 60 * 1000;

/** Quali parti dell'app può usare: Gestisci campionato, strumenti della Direzione Gara, strumenti dei Commissari. */
export interface AppAccess {
  readonly organization: boolean;
  readonly raceControl: boolean;
  readonly stewards: boolean;
}

export type MembershipCheck =
  | { readonly status: 'member-with-role'; readonly discordUserId: string; readonly access: AppAccess }
  | { readonly status: 'invalid-token' }
  | { readonly status: 'missing-role' }
  | { readonly status: 'discord-unavailable' };

interface MembershipSettings {
  readonly guildId: string;
  /** Ruolo Organizzazione. */
  readonly organizationRoleId: string;
  /** Ruolo Direttore Gara. */
  readonly raceControlRoleId: string;
  /** Ruolo Commissari Sportivi. */
  readonly stewardsRoleId: string;
}

interface DiscordGuildMember {
  readonly user?: { readonly id?: string };
  readonly roles?: readonly string[];
}

/**
 * Le verifiche riuscite restano valide qualche minuto per non interrogare Discord a ogni richiesta.
 * La chiave è l'hash del token: il token in chiaro non resta in memoria.
 */
const verifiedMemberships = new Map<string, { readonly discordUserId: string; readonly access: AppAccess; readonly expiresAt: number }>();


export async function checkDiscordMembership(
  accessToken: string,
  { guildId, organizationRoleId, raceControlRoleId, stewardsRoleId }: MembershipSettings,
  fetchFromDiscord: typeof fetch = fetch,
): Promise<MembershipCheck> {
  const tokenHash = await hashToken(accessToken);
  const cachedMembership = verifiedMemberships.get(tokenHash);
  if (cachedMembership && cachedMembership.expiresAt > Date.now()) {
    return { status: 'member-with-role', discordUserId: cachedMembership.discordUserId, access: cachedMembership.access };
  }

  let memberResponse: Response;
  try {
    memberResponse = await fetchWithDiscordRetry(
      fetchFromDiscord,
      `${DISCORD_API_URL}/users/@me/guilds/${guildId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      MEMBER_READ_RETRY,
    );
  } catch {
    console.warn('Discord non raggiungibile su /users/@me/guilds/:server/member (app)');
    return { status: 'discord-unavailable' };
  }

  if (memberResponse.status === 401) return { status: 'invalid-token' };
  if (memberResponse.status === 404 || memberResponse.status === 403) return { status: 'missing-role' };
  if (!memberResponse.ok) {
    console.warn(`${describeDiscordFailure(memberResponse, '/users/@me/guilds/:server/member')} (app)`);
    return { status: 'discord-unavailable' };
  }

  const guildMember = (await memberResponse.json()) as DiscordGuildMember;
  const discordUserId = guildMember.user?.id;
  const roles = guildMember.roles ?? [];
  const access: AppAccess = {
    organization: roles.includes(organizationRoleId),
    raceControl: roles.includes(raceControlRoleId),
    stewards: roles.includes(stewardsRoleId),
  };
  if (!discordUserId || (!access.organization && !access.raceControl && !access.stewards)) return { status: 'missing-role' };

  verifiedMemberships.set(tokenHash, { discordUserId, access, expiresAt: Date.now() + VERIFIED_MEMBERSHIP_TTL_MS });
  return { status: 'member-with-role', discordUserId, access };
}

/** Solo per i test: svuota le verifiche memorizzate. */
export function clearVerifiedMembershipsForTests() {
  verifiedMemberships.clear();
}
