import { AuthError } from '../model/authErrors';
import { toUserProfile, type UserProfile } from '../model/discordProfile';
import { fetchGuildMember } from './discordApi';

/**
 * Consente l'accesso solo a chi ha nel server almeno uno dei ruoli dell'app (Organizzazione, Direttore Gara o
 * Commissari Sportivi); restituisce il profilo da mostrare, con le parti dell'app che può usare.
 */
export async function verifyGuildAccess(accessToken: string): Promise<UserProfile> {
  const guildMember = await fetchGuildMember(accessToken);
  const profile = toUserProfile(guildMember.user, guildMember.roles);
  if (!profile.access.organization && !profile.access.raceControl && !profile.access.stewards) throw new AuthError('missing-role');
  return profile;
}
