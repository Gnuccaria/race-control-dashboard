/**
 * Verifica lato server i ruoli dell'app di chi fa la richiesta nel server Discord: Organizzazione, Direzione Gara
 * e Commissari Sportivi. Serve almeno uno dei tre. È il controllo che conta davvero: l'app desktop potrebbe essere
 * manomessa, il server no.
 */

import { hashToken } from '../discord/discordRateLimit';
import { lookupGuildMember } from '../discord/guildMemberLookup';

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
  /** La nostra applicazione Discord: si accettano solo i suoi token. */
  readonly applicationId: string;
  readonly guildId: string;
  /** Ruolo Organizzazione. */
  readonly organizationRoleId: string;
  /** Ruolo Direttore Gara. */
  readonly raceControlRoleId: string;
  /** Ruolo Commissari Sportivi. */
  readonly stewardsRoleId: string;
  /** Token del bot: i ruoli si leggono con il bot invece che con il token dell'utente (vedi guildMemberLookup). */
  readonly botToken?: string;
}

/**
 * Le verifiche riuscite restano valide qualche minuto per non interrogare Discord a ogni richiesta.
 * La chiave è l'hash del token: il token in chiaro non resta in memoria.
 */
const verifiedMemberships = new Map<string, { readonly discordUserId: string; readonly access: AppAccess; readonly expiresAt: number }>();


export async function checkDiscordMembership(
  accessToken: string,
  { applicationId, guildId, organizationRoleId, raceControlRoleId, stewardsRoleId, botToken }: MembershipSettings,
  fetchFromDiscord: typeof fetch = fetch,
): Promise<MembershipCheck> {
  const tokenHash = await hashToken(accessToken);
  const cachedMembership = verifiedMemberships.get(tokenHash);
  if (cachedMembership && cachedMembership.expiresAt > Date.now()) {
    return { status: 'member-with-role', discordUserId: cachedMembership.discordUserId, access: cachedMembership.access };
  }

  const lookup = await lookupGuildMember(fetchFromDiscord, { applicationId, guildId, botToken }, accessToken);
  if (lookup.status === 'invalid-token') return { status: 'invalid-token' };
  if (lookup.status === 'not-member') return { status: 'missing-role' };
  if (lookup.status === 'unavailable') return { status: 'discord-unavailable' };

  const discordUserId = lookup.user.id;
  const { roles } = lookup;
  const access: AppAccess = {
    organization: roles.includes(organizationRoleId),
    raceControl: roles.includes(raceControlRoleId),
    stewards: roles.includes(stewardsRoleId),
  };
  if (!access.organization && !access.raceControl && !access.stewards) return { status: 'missing-role' };

  verifiedMemberships.set(tokenHash, { discordUserId, access, expiresAt: Date.now() + VERIFIED_MEMBERSHIP_TTL_MS });
  return { status: 'member-with-role', discordUserId, access };
}

/** Solo per i test: svuota le verifiche memorizzate. */
export function clearVerifiedMembershipsForTests() {
  verifiedMemberships.clear();
}
