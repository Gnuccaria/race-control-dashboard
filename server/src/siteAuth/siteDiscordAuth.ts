import { SITE_DISCORD_CALLBACK_PATH, type SiteAuthErrorCode, type SiteSession, type SiteUserProfile } from '../../../shared/siteAuth';
import type { Env } from '../env';
import { jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import { describeDiscordFailure, fetchWithDiscordRetry, hashToken } from '../discord/discordRateLimit';
import { lookupGuildMember } from '../discord/guildMemberLookup';

/**
 * Accesso con Discord per il sito pubblico. Il server fa da tramite verso Discord (il browser non può chiamare
 * l'endpoint dei token per via del CORS) ma non conserva nulla: i token tornano al sito, che li tiene nel browser.
 * Flusso PKCE per client pubblici: nessun client secret.
 * Requisito: far parte del server Discord della lega (DISCORD_GUILD_ID); il ruolo non serve.
 *
 *   POST /public/discord/session   { code, codeVerifier, redirectUri } → SiteSession
 *   POST /public/discord/refresh   { refreshToken }                     → SiteSession
 *   GET  /public/discord/me        Authorization: Bearer <token>        → { profile }
 *   POST /public/discord/sign-out  { refreshToken }                     → 204 (revoca il token su Discord)
 */

const DISCORD_API_URL = 'https://discord.com/api/v10';
const DISCORD_CDN_URL = 'https://cdn.discordapp.com';
const MAX_SITE_AUTH_BODY_BYTES = 4096;

export type DiscordFetch = typeof fetch;

interface DiscordTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
}

class SiteAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: SiteAuthErrorCode,
  ) {
    super(code);
  }
}

const siteAuthError = (error: SiteAuthError) => jsonResponse(error.status, { error: { code: error.code } });

/** Avatar personalizzato, oppure uno di quelli predefiniti di Discord calcolato dall'ID. */
function avatarUrl(userId: string, avatar: string | null | undefined): string {
  if (avatar) return `${DISCORD_CDN_URL}/avatars/${userId}/${avatar}.png?size=128`;
  return `${DISCORD_CDN_URL}/embed/avatars/${Number((BigInt(userId) >> 22n) % 6n)}.png`;
}

/** POST a Discord: dopo un 429 si riprova (Discord non l'ha eseguita), mai dopo altri errori (il codice vale una volta). */
async function postToDiscord(discordFetch: DiscordFetch, env: Env, path: string, formFields: Record<string, string>): Promise<Response> {
  try {
    return await fetchWithDiscordRetry(
      discordFetch,
      `${DISCORD_API_URL}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.DISCORD_APPLICATION_ID, ...formFields }).toString(),
      },
      { maxWaitMs: 5000 },
    );
  } catch {
    console.warn(`Discord non raggiungibile su ${path}`);
    throw new SiteAuthError(503, 'discord-unavailable');
  }
}

async function requestTokens(discordFetch: DiscordFetch, env: Env, formFields: Record<string, string>): Promise<DiscordTokenResponse> {
  const tokenResponse = await postToDiscord(discordFetch, env, '/oauth2/token', formFields);
  if (tokenResponse.status === 400 || tokenResponse.status === 401) throw new SiteAuthError(401, 'invalid-grant');
  if (!tokenResponse.ok) {
    // Nei log del Worker (npx wrangler tail) resta il codice vero: 429 = limite di frequenza, 5xx = Discord in difficoltà.
    console.warn(describeDiscordFailure(tokenResponse, '/oauth2/token'));
    throw new SiteAuthError(503, 'discord-unavailable');
  }
  return (await tokenResponse.json()) as DiscordTokenResponse;
}

/** Chi ha fatto l'accesso al sito: profilo da mostrare e ID dei suoi ruoli nel server della lega. */
export interface SiteMember {
  readonly profile: SiteUserProfile;
  readonly roleIds: readonly string[];
}

async function fetchSiteMemberFromDiscord(discordFetch: DiscordFetch, env: Env, accessToken: string): Promise<SiteMember> {
  const lookup = await lookupGuildMember(discordFetch, { applicationId: env.DISCORD_APPLICATION_ID, guildId: env.DISCORD_GUILD_ID, botToken: env.DISCORD_BOT_TOKEN }, accessToken);
  if (lookup.status === 'invalid-token') throw new SiteAuthError(401, 'invalid-grant');
  if (lookup.status === 'not-member') throw new SiteAuthError(403, 'not-guild-member');
  if (lookup.status === 'unavailable') throw new SiteAuthError(503, 'discord-unavailable');
  const { user, nick, roles } = lookup;
  return {
    profile: {
      id: user.id,
      username: user.username,
      displayName: nick || user.global_name || user.username,
      avatarUrl: avatarUrl(user.id, user.avatar),
    },
    roleIds: roles,
  };
}

/**
 * Profilo e ruoli restano in memoria un minuto per token (chiave: hash del token, mai il token in chiaro), e le
 * richieste contemporanee con lo stesso token aspettano un'unica chiamata a Discord: aprendo una pagina il sito
 * manda insieme più richieste e Discord, interrogato più volte di fila, risponde 429. Se Discord non risponde,
 * per qualche minuto vale l'ultimo dato letto con successo. Un 401 o un 403 cancellano subito il dato in memoria.
 */
const SITE_MEMBER_FRESH_MS = 60 * 1000;
const SITE_MEMBER_STALE_MS = 10 * 60 * 1000;
const siteMembers = new Map<string, { readonly member: SiteMember; readonly fetchedAt: number }>();
const siteMembersInFlight = new Map<string, Promise<SiteMember>>();

/** Profilo e ruoli nel server della lega; 403 se l'account non ne fa parte, 401 se il token non vale più. */
export async function fetchSiteMember(discordFetch: DiscordFetch, env: Env, accessToken: string): Promise<SiteMember> {
  const tokenHash = `${env.DISCORD_GUILD_ID}:${await hashToken(accessToken)}`;
  const cached = siteMembers.get(tokenHash);
  if (cached && Date.now() - cached.fetchedAt < SITE_MEMBER_FRESH_MS) return cached.member;
  const inFlight = siteMembersInFlight.get(tokenHash);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const member = await fetchSiteMemberFromDiscord(discordFetch, env, accessToken);
      if (siteMembers.size > 500) siteMembers.clear();
      siteMembers.set(tokenHash, { member, fetchedAt: Date.now() });
      return member;
    } catch (memberError) {
      const isUnavailable = memberError instanceof SiteAuthError && memberError.code === 'discord-unavailable';
      if (isUnavailable && cached && Date.now() - cached.fetchedAt < SITE_MEMBER_STALE_MS) return cached.member;
      if (!isUnavailable) siteMembers.delete(tokenHash);
      throw memberError;
    } finally {
      siteMembersInFlight.delete(tokenHash);
    }
  })();
  siteMembersInFlight.set(tokenHash, request);
  return request;
}

/** Solo per i test. */
export function clearSiteMembersForTests() {
  siteMembers.clear();
  siteMembersInFlight.clear();
}

export const fetchSiteProfile = async (discordFetch: DiscordFetch, env: Env, accessToken: string): Promise<SiteUserProfile> =>
  (await fetchSiteMember(discordFetch, env, accessToken)).profile;

async function revokeToken(discordFetch: DiscordFetch, env: Env, token: string): Promise<void> {
  try {
    await postToDiscord(discordFetch, env, '/oauth2/token/revoke', { token, token_type_hint: 'refresh_token' });
  } catch {
    // Discord non raggiungibile: il token scadrà comunque da solo.
  }
}

/** Token nuovi → sessione, solo per chi fa parte del server; altrimenti i token si revocano subito. */
async function toSession(discordFetch: DiscordFetch, env: Env, tokens: DiscordTokenResponse): Promise<SiteSession> {
  try {
    const profile = await fetchSiteProfile(discordFetch, env, tokens.access_token);
    return { profile, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  } catch (profileError) {
    if (profileError instanceof SiteAuthError && profileError.code === 'not-guild-member') await revokeToken(discordFetch, env, tokens.refresh_token);
    throw profileError;
  }
}

async function readStringFields<Field extends string>(request: Request, fields: readonly Field[]): Promise<Record<Field, string>> {
  const body = (await readJsonBody(request, MAX_SITE_AUTH_BODY_BYTES).catch(() => null)) as Record<string, unknown> | null;
  const values = {} as Record<Field, string>;
  for (const field of fields) {
    const value = body?.[field];
    if (typeof value !== 'string' || value === '' || value.length > 2048) throw new SiteAuthError(400, 'invalid-request');
    values[field] = value;
  }
  return values;
}

/**
 * Il reindirizzamento deve essere la pagina di ritorno del sito che ha avviato l'accesso: stessa origine della
 * richiesta o dell'intestazione Origin (in sviluppo il sito gira su localhost e passa dal proxy di Vite).
 */
function isAllowedRedirect(request: Request, redirectUri: string): boolean {
  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    return false;
  }
  const allowedOrigins = [new URL(request.url).origin, request.headers.get('Origin')].filter(Boolean);
  return redirect.pathname === SITE_DISCORD_CALLBACK_PATH && redirect.search === '' && allowedOrigins.includes(redirect.origin);
}

function readBearerToken(request: Request): string | null {
  const [scheme, token] = (request.headers.get('Authorization') ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Per le richieste del sito che richiedono l'accesso (es. i ticket): profilo e ruoli di chi fa parte del server
 * Discord della lega, oppure la risposta di errore già pronta (401 token mancante o scaduto, 403 non membro).
 */
export async function authorizeSiteMember(discordFetch: DiscordFetch, env: Env, request: Request): Promise<SiteMember | Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) return siteAuthError(new SiteAuthError(401, 'invalid-grant'));
  try {
    return await fetchSiteMember(discordFetch, env, accessToken);
  } catch (profileError) {
    if (profileError instanceof SiteAuthError) return siteAuthError(profileError);
    throw profileError;
  }
}

export function createSiteAuthHandlers(discordFetch: DiscordFetch = fetch) {
  const handle = async (work: () => Promise<Response>): Promise<Response> => {
    try {
      return await work();
    } catch (handlerError) {
      if (handlerError instanceof SiteAuthError) {
        // Nei log del Worker (npx wrangler tail) l'esito vero dell'accesso, senza token né dati personali.
        console.warn(`Accesso al sito non riuscito: ${handlerError.status} ${handlerError.code}`);
        return siteAuthError(handlerError);
      }
      throw handlerError;
    }
  };

  return {
    startSession: (request: Request, env: Env) =>
      handle(async () => {
        const { code, codeVerifier, redirectUri } = await readStringFields(request, ['code', 'codeVerifier', 'redirectUri'] as const);
        if (!isAllowedRedirect(request, redirectUri)) throw new SiteAuthError(400, 'invalid-request');
        const tokens = await requestTokens(discordFetch, env, {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        });
        return jsonResponse(200, await toSession(discordFetch, env, tokens));
      }),

    refreshSession: (request: Request, env: Env) =>
      handle(async () => {
        const { refreshToken } = await readStringFields(request, ['refreshToken'] as const);
        const tokens = await requestTokens(discordFetch, env, { grant_type: 'refresh_token', refresh_token: refreshToken });
        return jsonResponse(200, await toSession(discordFetch, env, tokens));
      }),

    getProfile: (request: Request, env: Env) =>
      handle(async () => {
        const accessToken = readBearerToken(request);
        if (!accessToken) throw new SiteAuthError(401, 'invalid-grant');
        return jsonResponse(200, { profile: await fetchSiteProfile(discordFetch, env, accessToken) });
      }),

    signOut: (request: Request, env: Env) =>
      handle(async () => {
        const { refreshToken } = await readStringFields(request, ['refreshToken'] as const);
        await revokeToken(discordFetch, env, refreshToken);
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      }),
  };
}
