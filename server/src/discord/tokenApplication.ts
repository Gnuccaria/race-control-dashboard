import { describeDiscordFailure, fetchWithDiscordRetry, MEMBER_READ_RETRY } from './discordRateLimit';

/**
 * Per quale applicazione Discord è stato emesso un token. Senza questo controllo varrebbe qualunque token Discord con
 * lo scope "identify", anche emesso da un'altra applicazione: chi lo ottiene (per esempio con un'app Discord sua, a
 * cui un ufficiale ha dato l'accesso) potrebbe usarlo qui con i ruoli di quell'utente. Si accettano solo i token
 * della nostra applicazione (DISCORD_APPLICATION_ID) con gli scope che chiedono app e sito.
 */

const DISCORD_API_URL = 'https://discord.com/api/v10';

/** Scope chiesti da app desktop e sito (src/config/discordConfig.ts, shared/siteAuth.ts). */
export const REQUIRED_TOKEN_SCOPES = ['identify', 'guilds.members.read'] as const;

export type TokenApplicationCheck = 'ours' | 'foreign' | 'invalid-token' | 'unavailable';

interface DiscordAuthorizationInfo {
  readonly application?: { readonly id?: unknown };
  readonly scopes?: unknown;
}

/** GET /oauth2/@me: applicazione e scope del token. foreign = altra applicazione o scope mancanti. */
export async function checkTokenApplication(discordFetch: typeof fetch, applicationId: string, accessToken: string): Promise<TokenApplicationCheck> {
  let response: Response;
  try {
    response = await fetchWithDiscordRetry(discordFetch, `${DISCORD_API_URL}/oauth2/@me`, { headers: { Authorization: `Bearer ${accessToken}` } }, MEMBER_READ_RETRY);
  } catch {
    console.warn('Discord non raggiungibile su /oauth2/@me');
    return 'unavailable';
  }
  if (response.status === 401) return 'invalid-token';
  if (!response.ok) {
    console.warn(describeDiscordFailure(response, '/oauth2/@me'));
    return 'unavailable';
  }
  const info = (await response.json().catch(() => null)) as DiscordAuthorizationInfo | null;
  const scopes = Array.isArray(info?.scopes) ? (info.scopes as unknown[]) : [];
  const isOurs = info?.application?.id === applicationId && REQUIRED_TOKEN_SCOPES.every((scope) => scopes.includes(scope));
  if (!isOurs) console.warn('Token Discord rifiutato: emesso per un’altra applicazione o senza gli scope richiesti');
  return isOurs ? 'ours' : 'foreign';
}
