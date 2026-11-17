import type { Env } from '../env';
import { errorResponse } from '../http/jsonResponse';
import { type AppAccess, checkDiscordMembership, type MembershipCheck } from './discordMembership';

export type MembershipChecker = (accessToken: string, env: Env) => Promise<MembershipCheck>;

export const checkMembershipWithDiscord: MembershipChecker = (accessToken, env) =>
  checkDiscordMembership(accessToken, {
    guildId: env.DISCORD_GUILD_ID,
    organizationRoleId: env.DISCORD_ORGANIZATION_ROLE_ID,
    raceControlRoleId: env.DISCORD_REQUIRED_ROLE_ID,
    stewardsRoleId: env.DISCORD_STEWARDS_ROLE_ID,
    botToken: env.DISCORD_BOT_TOKEN,
  });

/**
 * Chi può usare un endpoint: organization = ruolo Organizzazione (Gestisci campionato), raceControl = ruolo
 * Direttore Gara, stewards = ruolo Commissari Sportivi; un elenco = uno qualsiasi di quei ruoli; any = uno
 * qualsiasi dei ruoli dell'app (es. leggere equipaggi e gare, che servono a tutti).
 */
export type RequiredAccess = keyof AppAccess | readonly (keyof AppAccess)[] | 'any';

const hasAccess = (access: AppAccess, required: RequiredAccess): boolean =>
  required === 'any' ? true : typeof required === 'string' ? access[required] : required.some((key) => access[key]);

export interface AuthorizedUser {
  readonly discordUserId: string;
}

function readBearerToken(request: Request): string | null {
  const authorizationHeader = request.headers.get('Authorization') ?? '';
  const [scheme, token] = authorizationHeader.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Primo controllo di ogni richiesta dell'app: utente Discord autenticato con il ruolo richiesto dall'endpoint.
 * Restituisce l'utente oppure la risposta di errore già pronta.
 */
export async function authorizeRequest(
  request: Request,
  env: Env,
  checkMembership: MembershipChecker,
  requiredAccess: RequiredAccess = 'organization',
): Promise<AuthorizedUser | Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) return errorResponse(401, 'not-signed-in');

  const membership = await checkMembership(accessToken, env);
  if (membership.status === 'invalid-token') return errorResponse(401, 'not-signed-in');
  if (membership.status === 'missing-role') return errorResponse(403, 'missing-role');
  if (membership.status === 'discord-unavailable') return errorResponse(503, 'discord-unavailable');
  if (!hasAccess(membership.access, requiredAccess)) return errorResponse(403, 'missing-role');
  return { discordUserId: membership.discordUserId };
}
