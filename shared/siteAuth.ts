/**
 * Accesso con Discord al sito pubblico: basta far parte del server Discord della lega (nessun ruolo richiesto,
 * a differenza dell'app). Tipi condivisi tra il sito e il server, che fa da tramite verso Discord.
 */

/** Percorso del sito a cui Discord rimanda dopo l'autorizzazione (va registrato nel Developer Portal). */
export const SITE_DISCORD_CALLBACK_PATH = '/accesso/discord';

/** identify: nome e avatar · guilds.members.read: verifica di far parte del server. */
export const SITE_DISCORD_SCOPES = ['identify', 'guilds.members.read'] as const;

export interface SiteUserProfile {
  readonly id: string;
  /** Handle Discord, senza la @. */
  readonly username: string;
  /** Nome visualizzato (nel server, se impostato; altrimenti quello globale o l'handle). */
  readonly displayName: string;
  readonly avatarUrl: string;
}

/** Risposta di accesso e rinnovo: profilo più i token, che il sito conserva nel browser. */
export interface SiteSession {
  readonly profile: SiteUserProfile;
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Scadenza del token di accesso, in millisecondi dall'epoca. */
  readonly expiresAt: number;
}

/** Errori che il server dell'accesso restituisce. */
export type SiteAuthErrorCode = 'not-guild-member' | 'invalid-grant' | 'discord-unavailable' | 'invalid-request';
export const SITE_AUTH_ERROR_CODES: readonly SiteAuthErrorCode[] = ['not-guild-member', 'invalid-grant', 'discord-unavailable', 'invalid-request'];
