const DISCORD_CDN_URL = 'https://cdn.discordapp.com';
const DEFAULT_AVATAR_COUNT = 6;

/** Utente come restituito dall'API di Discord (solo i campi usati). */
export interface DiscordUser {
  readonly id: string;
  readonly username: string;
  readonly global_name: string | null;
  readonly avatar: string | null;
}

/** Membro del server come restituito da /users/@me/guilds/{id}/member (solo i campi usati). */
export interface DiscordGuildMember {
  readonly user: DiscordUser;
  readonly roles: readonly string[];
}

import { DISCORD_CONFIG } from '@/config/discordConfig';

/** Parti dell'app che l'utente può usare, dai suoi ruoli nel server: per entrare ne serve almeno una. */
export interface AppAccess {
  /** Ruolo Organizzazione: Gestisci campionato. */
  readonly organization: boolean;
  /** Ruolo Direttore Gara: Crea documentazione e strumenti della Direzione Gara. */
  readonly raceControl: boolean;
  /** Ruolo Commissari Sportivi: strumenti dei Commissari Sportivi. */
  readonly stewards: boolean;
}

export const appAccessFromRoles = (roles: readonly string[]): AppAccess => ({
  organization: roles.includes(DISCORD_CONFIG.organizationRoleId),
  raceControl: roles.includes(DISCORD_CONFIG.raceControlRoleId),
  stewards: roles.includes(DISCORD_CONFIG.stewardsRoleId),
});

/** Profilo mostrato nell'app. Vive solo in memoria: non viene mai salvato. */
export interface UserProfile {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly access: AppAccess;
}

/** Avatar personalizzato, oppure uno di quelli predefiniti di Discord calcolato dall'ID. */
export function getAvatarUrl({ id, avatar }: DiscordUser): string {
  if (avatar) return `${DISCORD_CDN_URL}/avatars/${id}/${avatar}.png?size=128`;
  const defaultAvatarIndex = Number((BigInt(id) >> BigInt(22)) % BigInt(DEFAULT_AVATAR_COUNT));
  return `${DISCORD_CDN_URL}/embed/avatars/${defaultAvatarIndex}.png`;
}

export function toUserProfile(discordUser: DiscordUser, roles: readonly string[] = []): UserProfile {
  return {
    id: discordUser.id,
    username: discordUser.username,
    displayName: discordUser.global_name ?? discordUser.username,
    avatarUrl: getAvatarUrl(discordUser),
    access: appAccessFromRoles(roles),
  };
}

export const hasRole = (guildMember: DiscordGuildMember, roleId: string): boolean => guildMember.roles.includes(roleId);
