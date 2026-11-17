import { type DiscordRetryOptions, describeDiscordFailure, fetchDiscordWithRetry } from '@shared/discordRetry';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { DISCORD_CONFIG, DISCORD_REDIRECT_URI } from '@/config/discordConfig';
import { AuthError } from '../model/authErrors';
import type { DiscordGuildMember } from '../model/discordProfile';

/** Le chiamate passano dal lato nativo di Tauri: niente blocchi CORS, solo verso discord.com/api. */
const DISCORD_API_URL = 'https://discord.com/api/v10';

export interface DiscordTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

interface DiscordTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
}

/**
 * Chiamata a Discord con i nuovi tentativi per i limiti di frequenza (shared/discordRetry.ts). Il fetch di Tauri
 * segnala i problemi di rete con un errore qualsiasi (anche una stringa): diventano tutti AuthError('network').
 */
async function callDiscord(path: string, init: RequestInit, retryOptions: DiscordRetryOptions): Promise<Response> {
  try {
    return await fetchDiscordWithRetry((url, requestInit) => tauriFetch(url, requestInit), `${DISCORD_API_URL}${path}`, init, { maxWaitMs: 5000, ...retryOptions });
  } catch (networkError) {
    console.warn(`Discord non raggiungibile su ${path}`, networkError);
    throw new AuthError('network');
  }
}

/** Risposta di errore inattesa: 429 = troppe richieste (si riprova tra poco), il resto = Discord non disponibile. */
function unexpectedResponseError(response: Response, path: string): AuthError {
  console.warn(describeDiscordFailure(response, path));
  return new AuthError(response.status === 429 ? 'rate-limited' : 'network');
}

/** POST: dopo un 429 si riprova (Discord non l'ha eseguita), mai dopo altri errori (un codice vale una volta sola). */
function postForm(path: string, formFields: Record<string, string>) {
  return callDiscord(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: DISCORD_CONFIG.applicationId, ...formFields }).toString(),
    },
    {},
  );
}

async function requestTokens(formFields: Record<string, string>, invalidGrantError: AuthError): Promise<DiscordTokens> {
  const tokenResponse = await postForm('/oauth2/token', formFields);
  if (tokenResponse.status === 400 || tokenResponse.status === 401) throw invalidGrantError;
  if (!tokenResponse.ok) throw unexpectedResponseError(tokenResponse, '/oauth2/token');

  const tokens = (await tokenResponse.json()) as DiscordTokenResponse;
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

/** Scambia il codice di autorizzazione con i token, dimostrando il possesso del code_verifier (PKCE). */
export function exchangeAuthorizationCode(authorizationCode: string, codeVerifier: string): Promise<DiscordTokens> {
  return requestTokens(
    {
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: DISCORD_REDIRECT_URI,
      code_verifier: codeVerifier,
    },
    new AuthError('unexpected'),
  );
}

/** Ottiene nuovi token dal token di rinnovo salvato. Discord ruota il token di rinnovo a ogni utilizzo. */
export function refreshTokens(refreshToken: string): Promise<DiscordTokens> {
  return requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken }, new AuthError('session-expired'));
}

/** Profilo e ruoli dell'utente nel server configurato. */
export async function fetchGuildMember(accessToken: string): Promise<DiscordGuildMember> {
  // Lettura ripetibile: si riprova anche dopo un errore passeggero di Discord o della rete.
  const memberResponse = await callDiscord(
    `/users/@me/guilds/${DISCORD_CONFIG.guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { retryServerErrors: true },
  );

  if (memberResponse.status === 404) throw new AuthError('not-guild-member');
  if (memberResponse.status === 401) throw new AuthError('session-expired');
  if (!memberResponse.ok) throw unexpectedResponseError(memberResponse, '/users/@me/guilds/:server/member');
  return (await memberResponse.json()) as DiscordGuildMember;
}

/** Invalida un token su Discord. Tentativo "migliore possibile": un errore qui non blocca il logout. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await postForm('/oauth2/token/revoke', { token, token_type_hint: 'refresh_token' });
  } catch {
    // Offline o Discord non raggiungibile: il token scadrà comunque da solo.
  }
}
