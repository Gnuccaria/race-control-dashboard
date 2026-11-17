import { crewNumberFromRoleName, type TicketCrewOption, type TicketCrewProblem } from '../../../shared/disconnectionTicketRules';
import type { SqlDatabase } from '../database/sqlDatabase';
import type { Env } from '../env';
import { fetchGuildRoleNames } from '../siteAuth/discordGuildRoles';
import type { DiscordFetch } from '../siteAuth/siteDiscordAuth';
import { findTicketCrewByNumber, findTicketCrewsByRoleIds } from './ticketRepository';

/** roleId: il ruolo Discord dell'equipaggio, che il bot menziona quando scrive il risultato. */
export type TicketCrewLookup = { readonly crew: TicketCrewOption; readonly roleId: string } | { readonly problem: TicketCrewProblem };

/**
 * Equipaggio di chi apre un ticket o una protesta, dai suoi ruoli Discord (gli ID arrivano dall'accesso dell'utente):
 * 1. un equipaggio con il ruolo collegato nella sua scheda (discord_role_id): vale qualunque sia il nome del ruolo,
 *    e non serve il bot;
 * 2. altrimenti il nome del ruolo, letto dal bot ("#16 Vez Team Lime" → equipaggio n. 16), tra gli equipaggi senza
 *    ruolo collegato.
 * In entrambi i casi deve esserci un solo ruolo di equipaggio.
 */
export async function findTicketCrewFromRoles(
  discordFetch: DiscordFetch,
  env: Env,
  database: SqlDatabase,
  roleIds: readonly string[],
): Promise<TicketCrewLookup> {
  const linkedCrews = await findTicketCrewsByRoleIds(database, roleIds);
  if (linkedCrews.length > 1) return { problem: 'multiple-crew-roles' };
  const [linkedCrew] = linkedCrews;
  if (linkedCrew) {
    const { roleId, ...crew } = linkedCrew;
    return { crew, roleId };
  }

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
