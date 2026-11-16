export type AuthErrorKind =
  | 'missing-role'
  | 'not-guild-member'
  | 'access-denied'
  | 'login-timeout'
  | 'port-in-use'
  | 'session-expired'
  | 'network'
  | 'desktop-only'
  | 'unexpected';

/** Errore di accesso con un tipo noto: la schermata di login mostra il messaggio tradotto (messages.auth.errors). */
export class AuthError extends Error {
  readonly kind: AuthErrorKind;

  constructor(kind: AuthErrorKind) {
    super(kind);
    this.name = 'AuthError';
    this.kind = kind;
  }
}

/** Errore speciale: l'utente ha annullato dall'app. Non va mostrato come errore. */
export class AuthCancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'AuthCancelledError';
  }
}

/** Codici di errore restituiti dai comandi nativi (src-tauri/src/discord_oauth_redirect.rs). */
const NATIVE_ERROR_KINDS: Record<string, AuthErrorKind | 'cancelled'> = {
  LOGIN_TIMEOUT: 'login-timeout',
  PORT_IN_USE: 'port-in-use',
  LOGIN_CANCELLED: 'cancelled',
};

/** Riconduce qualsiasi errore a un tipo noto. */
export function toAuthError(caughtError: unknown): AuthError | AuthCancelledError {
  if (caughtError instanceof AuthError || caughtError instanceof AuthCancelledError) return caughtError;

  if (typeof caughtError === 'string') {
    const nativeErrorKind = NATIVE_ERROR_KINDS[caughtError];
    if (nativeErrorKind === 'cancelled') return new AuthCancelledError();
    if (nativeErrorKind) return new AuthError(nativeErrorKind);
  }

  // fetch segnala i problemi di rete con un TypeError.
  if (caughtError instanceof TypeError) return new AuthError('network');
  return new AuthError('unexpected');
}
