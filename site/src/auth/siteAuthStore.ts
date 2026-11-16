import { SITE_DISCORD_CALLBACK_PATH, SITE_DISCORD_SCOPES, type SiteSession, type SiteUserProfile } from '@shared/siteAuth';
import { useSyncExternalStore } from 'react';
import { DISCORD_CONFIG } from '@/config/discordConfig';
import { createPkcePair, createRandomToken } from '@/features/auth/model/pkce';
import { endSiteSession, fetchSiteProfile, refreshSiteSession, type SiteSignInErrorCode, startSiteSession } from './siteAuthApi';

/**
 * Accesso con Discord nel sito. Basta far parte del server Discord della lega (lo controlla il server).
 * I token restano in questo browser (localStorage) finché non si esce; il profilo si rilegge dal server a ogni
 * apertura, così chi lascia il server Discord perde l'accesso.
 */

export type SiteAuthState =
  | { readonly status: 'checking' }
  | { readonly status: 'signed-out'; readonly errorCode?: SiteSignInErrorCode }
  | { readonly status: 'signed-in'; readonly profile: SiteUserProfile };

interface StoredTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

/** Dati del tentativo di accesso in corso, tenuti nella scheda fino al ritorno da Discord. */
interface PendingSignIn {
  readonly state: string;
  readonly codeVerifier: string;
  readonly returnTo: string;
}

const TOKENS_STORAGE_KEY = 'race-control-site-discord-tokens';
const PENDING_STORAGE_KEY = 'race-control-site-discord-pending';
/** Si rinnova il token quando manca meno di un giorno alla scadenza. */
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

let state: SiteAuthState = { status: 'checking' };
const listeners = new Set<() => void>();

function setState(nextState: SiteAuthState) {
  state = nextState;
  for (const listener of listeners) listener();
}

function readStorage<Value>(storage: Storage, key: string): Value | null {
  try {
    const text = storage.getItem(key);
    return text ? (JSON.parse(text) as Value) : null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: unknown) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    // Archiviazione non disponibile (es. navigazione privata molto restrittiva): l'accesso dura finché la pagina è aperta.
  }
}

const redirectUri = () => `${window.location.origin}${SITE_DISCORD_CALLBACK_PATH}`;

function saveSession(session: SiteSession) {
  writeStorage(localStorage, TOKENS_STORAGE_KEY, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  } satisfies StoredTokens);
  setState({ status: 'signed-in', profile: session.profile });
}

function forgetSession(errorCode?: SiteSignInErrorCode) {
  writeStorage(localStorage, TOKENS_STORAGE_KEY, null);
  setState(errorCode ? { status: 'signed-out', errorCode } : { status: 'signed-out' });
}

async function refresh(tokens: StoredTokens) {
  const refreshed = await refreshSiteSession(tokens.refreshToken);
  if (refreshed.isSuccess) saveSession(refreshed.value);
  else if (refreshed.errorCode === 'invalid-grant' || refreshed.errorCode === 'invalid-request') forgetSession();
  else if (refreshed.errorCode === 'not-guild-member') forgetSession('not-guild-member');
  // Discord o server non disponibili: i token restano, si riprova alla prossima apertura.
  else setState({ status: 'signed-out', errorCode: refreshed.errorCode });
}

/** Attese prima di riprovare se Discord o il server non rispondono per un momento (es. troppe richieste di fila). */
const RESTORE_RETRY_DELAYS_MS = [1500, 4000];

/** Profilo all'apertura: un errore passeggero non deve far sembrare uscito chi ha ancora i token validi. */
async function fetchProfileWithRetry(accessToken: string): ReturnType<typeof fetchSiteProfile> {
  let profile = await fetchSiteProfile(accessToken);
  for (const delayMs of RESTORE_RETRY_DELAYS_MS) {
    if (profile.isSuccess || profile.errorCode === 'invalid-grant' || profile.errorCode === 'not-guild-member') break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    profile = await fetchSiteProfile(accessToken);
  }
  return profile;
}

/** All'apertura del sito: riprende l'accesso salvato, se c'è. */
export async function restoreSiteSession(): Promise<void> {
  if (window.location.pathname === SITE_DISCORD_CALLBACK_PATH) return; // ci pensa la pagina di ritorno
  const tokens = readStorage<StoredTokens>(localStorage, TOKENS_STORAGE_KEY);
  if (!tokens) {
    setState({ status: 'signed-out' });
    return;
  }
  if (tokens.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    await refresh(tokens);
    return;
  }
  const profile = await fetchProfileWithRetry(tokens.accessToken);
  if (profile.isSuccess) setState({ status: 'signed-in', profile: profile.value });
  else if (profile.errorCode === 'invalid-grant') await refresh(tokens);
  else if (profile.errorCode === 'not-guild-member') forgetSession('not-guild-member');
  else setState({ status: 'signed-out', errorCode: profile.errorCode });
}

/** Porta alla pagina di autorizzazione di Discord; al ritorno si torna a returnTo (di solito la pagina attuale). */
export async function signInWithDiscord(returnTo = `${window.location.pathname}${window.location.search}`): Promise<void> {
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const pendingSignIn: PendingSignIn = { state: createRandomToken(), codeVerifier, returnTo };
  writeStorage(sessionStorage, PENDING_STORAGE_KEY, pendingSignIn);
  const authorizeParameters = new URLSearchParams({
    client_id: DISCORD_CONFIG.applicationId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SITE_DISCORD_SCOPES.join(' '),
    state: pendingSignIn.state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'none',
  });
  window.location.assign(`https://discord.com/oauth2/authorize?${authorizeParameters.toString()}`);
}

/** Pagina di ritorno da Discord: completa l'accesso e dice dove tornare (o l'errore). */
export type SignInCompletion = { readonly isSuccess: true; readonly returnTo: string } | { readonly isSuccess: false; readonly errorCode: SiteSignInErrorCode | 'access-denied' };

let completion: Promise<SignInCompletion> | null = null;

export function completeSignIn(searchParams: URLSearchParams): Promise<SignInCompletion> {
  // Una sola volta per pagina (in sviluppo React esegue due volte gli effetti; il codice vale una volta sola).
  completion ??= (async () => {
    const pendingSignIn = readStorage<PendingSignIn>(sessionStorage, PENDING_STORAGE_KEY);
    writeStorage(sessionStorage, PENDING_STORAGE_KEY, null);
    if (searchParams.get('error') === 'access_denied') {
      setState({ status: 'signed-out' });
      return { isSuccess: false, errorCode: 'access-denied' };
    }
    const code = searchParams.get('code');
    if (!pendingSignIn || !code || searchParams.get('state') !== pendingSignIn.state) {
      setState({ status: 'signed-out' });
      return { isSuccess: false, errorCode: 'invalid-request' };
    }
    const session = await startSiteSession(code, pendingSignIn.codeVerifier, redirectUri());
    if (!session.isSuccess) {
      setState({ status: 'signed-out', errorCode: session.errorCode });
      return { isSuccess: false, errorCode: session.errorCode };
    }
    saveSession(session.value);
    // Solo percorsi interni al sito.
    const returnTo = pendingSignIn.returnTo.startsWith('/') && !pendingSignIn.returnTo.startsWith('//') ? pendingSignIn.returnTo : '/';
    return { isSuccess: true, returnTo };
  })();
  return completion;
}

/** Esce: dimentica i token in questo browser e li revoca su Discord. */
export async function signOutOfSite(): Promise<void> {
  const tokens = readStorage<StoredTokens>(localStorage, TOKENS_STORAGE_KEY);
  forgetSession();
  if (tokens) await endSiteSession(tokens.refreshToken);
}

/** Margine per le richieste: un token che scade entro 5 minuti si rinnova prima di usarlo. */
const REQUEST_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Token di accesso valido per le richieste che lo richiedono (es. i ticket), rinnovato se sta per scadere; null se non si è entrati. */
export async function getFreshSiteAccessToken(): Promise<string | null> {
  if (state.status !== 'signed-in') return null;
  const tokens = readStorage<StoredTokens>(localStorage, TOKENS_STORAGE_KEY);
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() > REQUEST_REFRESH_MARGIN_MS) return tokens.accessToken;
  await refresh(tokens);
  return state.status === 'signed-in' ? (readStorage<StoredTokens>(localStorage, TOKENS_STORAGE_KEY)?.accessToken ?? null) : null;
}

/** Il server ha rifiutato il token (scaduto o revocato): si esce e si chiede di accedere di nuovo. */
export function endExpiredSiteSession() {
  forgetSession('invalid-grant');
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSiteAuth = (): SiteAuthState => useSyncExternalStore(subscribe, () => state);
