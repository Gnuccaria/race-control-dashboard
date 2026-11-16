import { SITE_AUTH_ERROR_CODES, type SiteAuthErrorCode, type SiteSession, type SiteUserProfile } from '@shared/siteAuth';
import { API_BASE_URL } from '../api/publicRaces';

/**
 * Errori che il sito sa spiegare: quelli del server più due del sito.
 * - server-outdated: il server non conosce l'accesso con Discord (404/405), cioè non è stato ripubblicato;
 * - unexpected: qualsiasi altra risposta inattesa.
 */
export type SiteSignInErrorCode = SiteAuthErrorCode | 'server-outdated' | 'unexpected';

/** Esito di una chiamata di accesso: dati, oppure il motivo per cui non è andata. */
export type SiteAuthResult<Value> = { readonly isSuccess: true; readonly value: Value } | { readonly isSuccess: false; readonly errorCode: SiteSignInErrorCode };

const isKnownErrorCode = (code: unknown): code is SiteAuthErrorCode => SITE_AUTH_ERROR_CODES.some((known) => known === code);

async function callSiteAuth<Value>(path: string, init: RequestInit): Promise<SiteAuthResult<Value>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/public/discord/${path}`, { ...init, headers: { Accept: 'application/json', ...init.headers } });
  } catch {
    return { isSuccess: false, errorCode: 'discord-unavailable' };
  }
  if (response.status === 204) return { isSuccess: true, value: undefined as Value };
  const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
  if (response.ok && body) return { isSuccess: true, value: body as Value };
  const code = body?.error?.code;
  if (isKnownErrorCode(code)) return { isSuccess: false, errorCode: code };
  if (response.status === 404 || response.status === 405) return { isSuccess: false, errorCode: 'server-outdated' };
  return { isSuccess: false, errorCode: 'unexpected' };
}

const postJson = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const startSiteSession = (code: string, codeVerifier: string, redirectUri: string) =>
  callSiteAuth<SiteSession>('session', postJson({ code, codeVerifier, redirectUri }));

export const refreshSiteSession = (refreshToken: string) => callSiteAuth<SiteSession>('refresh', postJson({ refreshToken }));

export const fetchSiteProfile = async (accessToken: string): Promise<SiteAuthResult<SiteUserProfile>> => {
  const result = await callSiteAuth<{ profile: SiteUserProfile }>('me', { headers: { Authorization: `Bearer ${accessToken}` } });
  return result.isSuccess ? { isSuccess: true, value: result.value.profile } : result;
};

export const endSiteSession = (refreshToken: string) => callSiteAuth<undefined>('sign-out', postJson({ refreshToken }));
