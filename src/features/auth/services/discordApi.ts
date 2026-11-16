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

function postForm(path: string, formFields: Record<string, string>) {
  return tauriFetch(`${DISCORD_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: DISCORD_CONFIG.applicationId, ...formFields }).toString(),
  });
}

async function requestTokens(formFields: Record<string, string>, invalidGrantError: AuthError): Promise<DiscordTokens> {
  const tokenResponse = await postForm('/oauth2/token', formFields);
  if (tokenResponse.status === 400 || tokenResponse.status === 401) throw invalidGrantError;
  if (!tokenResponse.ok) throw new AuthError('network');

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
  const memberResponse = await tauriFetch(`${DISCORD_API_URL}/users/@me/guilds/${DISCORD_CONFIG.guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (memberResponse.status === 404) throw new AuthError('not-guild-member');
  if (memberResponse.status === 401) throw new AuthError('session-expired');
  if (!memberResponse.ok) throw new AuthError('network');
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
