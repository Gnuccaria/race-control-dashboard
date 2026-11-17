import { type DiscordRetryOptions, fetchDiscordWithRetry } from '../../../shared/discordRetry';

export { describeDiscordFailure } from '../../../shared/discordRetry';

/**
 * Chiamate a Discord dal server con i nuovi tentativi per i 429 (e, se richiesto, per gli errori passeggeri del
 * server di Discord): logica in shared/discordRetry.ts, condivisa con l'app.
 */
export const fetchWithDiscordRetry = (discordFetch: typeof fetch, url: string, init: RequestInit, options?: DiscordRetryOptions): Promise<Response> =>
  fetchDiscordWithRetry((requestUrl, requestInit) => discordFetch(requestUrl, requestInit), url, init, options);

/** Lettura del profilo e dei ruoli: si può ripetere, e chi aspetta (accesso, pagina del sito) tollera qualche secondo. */
export const MEMBER_READ_RETRY: DiscordRetryOptions = { maxWaitMs: 5000, retryServerErrors: true };

export async function hashToken(accessToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
