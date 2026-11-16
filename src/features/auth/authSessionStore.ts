/**
 * Stato della sessione, esterno a React e letto con useSyncExternalStore.
 * Profilo e token di accesso vivono solo in memoria: il token serve al server degli
 * equipaggi per verificare il ruolo a ogni richiesta. L'unico dato persistente è il token
 * di rinnovo nell'archivio sicuro del sistema, e solo se l'utente sceglie "Ricorda l'accesso".
 */
import { AuthCancelledError, AuthError, type AuthErrorKind, toAuthError } from './model/authErrors';
import { buildAuthorizeUrl, readAuthorizationCode } from './model/authorizationRequest';
import type { UserProfile } from './model/discordProfile';
import { createPkcePair, createRandomToken } from './model/pkce';
import {
  authorizeInBrowser,
  type BrowserCompletionPage,
  cancelBrowserAuthorization,
  deleteSavedRefreshToken,
  isDesktopApp,
  readSavedRefreshToken,
  saveRefreshToken,
} from './services/desktopBridge';
import { type DiscordTokens, exchangeAuthorizationCode, refreshTokens, revokeToken } from './services/discordApi';
import { verifyGuildAccess } from './services/verifyGuildAccess';

export type AuthSession =
  | { readonly status: 'restoring' }
  | { readonly status: 'signed-out'; readonly errorKind: AuthErrorKind | null }
  | { readonly status: 'signing-in' }
  | { readonly status: 'signed-in'; readonly user: UserProfile };

const SIGNED_OUT: AuthSession = { status: 'signed-out', errorKind: null };

let currentSession: AuthSession = { status: 'restoring' };
const sessionListeners = new Set<() => void>();

/** Token della sessione corrente, mai salvati su disco né esposti allo stato React. */
let sessionTokens: DiscordTokens | null = null;

/** Token da presentare al server per le operazioni protette; null se non c'è una sessione. */
export const getSessionAccessToken = (): string | null => sessionTokens?.accessToken ?? null;

function setSession(nextSession: AuthSession) {
  currentSession = nextSession;
  for (const listener of sessionListeners) listener();
}

export const getAuthSession = (): AuthSession => currentSession;

export function subscribeToAuthSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/** Riporta alla schermata di login mostrando l'errore, se ce n'è uno da spiegare. */
function signOutWithError(caughtError: unknown) {
  const authError = toAuthError(caughtError);
  setSession(authError instanceof AuthCancelledError ? SIGNED_OUT : { status: 'signed-out', errorKind: authError.kind });
}

const forgetSavedRefreshToken = () => deleteSavedRefreshToken().catch(() => undefined);

const isNetworkError = (caughtError: unknown) => {
  const authError = toAuthError(caughtError);
  return authError instanceof AuthError && authError.kind === 'network';
};

/**
 * All'avvio: se c'è un accesso ricordato lo rinnova e ricontrolla il ruolo, così chi ha perso
 * il ruolo non entra più. Senza accesso ricordato mostra la schermata di login.
 */
export async function restoreSavedSession(): Promise<void> {
  if (!isDesktopApp()) {
    setSession(SIGNED_OUT);
    return;
  }

  try {
    const savedRefreshToken = await readSavedRefreshToken();
    if (!savedRefreshToken) {
      setSession(SIGNED_OUT);
      return;
    }

    const tokens = await refreshTokens(savedRefreshToken);
    await saveRefreshToken(tokens.refreshToken);
    const user = await verifyGuildAccess(tokens.accessToken);
    sessionTokens = tokens;
    setSession({ status: 'signed-in', user });
  } catch (caughtError) {
    // Offline: si conserva l'accesso ricordato per il prossimo avvio. Negli altri casi non è più valido.
    if (!isNetworkError(caughtError)) await forgetSavedRefreshToken();
    signOutWithError(caughtError);
  }
}

interface SignInOptions {
  readonly rememberAccess: boolean;
  /** Pagina mostrata nel browser a login concluso, già tradotta. */
  readonly browserCompletionPage: BrowserCompletionPage;
}

export async function signInWithDiscord({ rememberAccess, browserCompletionPage }: SignInOptions): Promise<void> {
  if (!isDesktopApp()) {
    setSession({ status: 'signed-out', errorKind: 'desktop-only' });
    return;
  }

  setSession({ status: 'signing-in' });
  try {
    const { codeVerifier, codeChallenge } = await createPkcePair();
    const expectedState = createRandomToken();

    const redirectTarget = await authorizeInBrowser(
      buildAuthorizeUrl({ codeChallenge, state: expectedState }),
      browserCompletionPage,
    );
    const authorizationCode = readAuthorizationCode(redirectTarget, expectedState);
    const tokens = await exchangeAuthorizationCode(authorizationCode, codeVerifier);
    const user = await verifyGuildAccess(tokens.accessToken);

    // Con "Ricorda l'accesso" il token di rinnovo va nell'archivio sicuro; senza, resta solo in memoria
    // e viene invalidato all'uscita.
    if (rememberAccess) await saveRefreshToken(tokens.refreshToken);

    sessionTokens = tokens;
    setSession({ status: 'signed-in', user });
  } catch (caughtError) {
    signOutWithError(caughtError);
  }
}

export async function cancelSignIn(): Promise<void> {
  await cancelBrowserAuthorization();
}

/** Esce: invalida i token su Discord, dimentica l'accesso ricordato e riparte dalla home al prossimo login. */
export async function signOut(): Promise<void> {
  const refreshTokenToRevoke = sessionTokens?.refreshToken ?? (await readSavedRefreshToken().catch(() => null));
  sessionTokens = null;
  await forgetSavedRefreshToken();
  if (refreshTokenToRevoke) void revokeToken(refreshTokenToRevoke);

  window.location.hash = '#/';
  setSession(SIGNED_OUT);
}

/** Solo per i test: imposta direttamente lo stato della sessione (ed eventualmente i token). */
export function replaceAuthSessionForTests(nextSession: AuthSession, testTokens: DiscordTokens | null = null) {
  sessionTokens = testTokens;
  setSession(nextSession);
}
