import { crewNumberFromRoleName, type TicketCrewOption, type TicketCrewProblem } from '../../../shared/disconnectionTicketRules';
import type { SqlDatabase } from '../database/sqlDatabase';
import type { Env } from '../env';
import { fetchGuildRoleNames } from '../siteAuth/discordGuildRoles';
import type { DiscordFetch } from '../siteAuth/siteDiscordAuth';
import { findTicketCrewByNumber } from './ticketRepository';

/** roleId: il ruolo Discord dell'equipaggio, che il bot menziona quando scrive il risultato. */
export type TicketCrewLookup = { readonly crew: TicketCrewOption; readonly roleId: string } | { readonly problem: TicketCrewProblem };

/**
 * Equipaggio di chi apre il ticket, dal suo ruolo Discord di equipaggio ("#16 Vez Team Lime" → equipaggio n. 16).
 * Gli ID dei ruoli arrivano dall'accesso dell'utente, i nomi dal bot. Deve esserci un solo ruolo di equipaggio.
 */
export async function findTicketCrewFromRoles(
  discordFetch: DiscordFetch,
  env: Env,
  database: SqlDatabase,
  roleIds: readonly string[],
): Promise<TicketCrewLookup> {
  const roleNames = await fetchGuildRoleNames(discordFetch, env);
  if (!roleNames) return { problem: 'bot-unavailable' };
  const crewRoles = roleIds.flatMap((roleId) => {
    const crewNumber = crewNumberFromRoleName(roleNames.get(roleId) ?? '');
    return crewNumber === null ? [] : [{ roleId, crewNumber }];
  });
  const crewNumbers = new Set(crewRoles.map((crewRole) => crewRole.crewNumber));
  if (crewNumbers.size === 0) return { problem: 'no-crew-role' };
  if (crewNumbers.size > 1) return { problem: 'multiple-crew-roles' };
  const [crewRole] = crewRoles;
  const crew = crewRole === undefined ? null : await findTicketCrewByNumber(database, crewRole.crewNumber);
  return crew && crewRole ? { crew, roleId: crewRole.roleId } : { problem: 'crew-not-found' };
}
