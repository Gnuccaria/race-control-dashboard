import { DISCORD_CONFIG, DISCORD_REDIRECT_URI } from '@/config/discordConfig';
import { AuthError } from './authErrors';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';

interface AuthorizeUrlOptions {
  readonly codeChallenge: string;
  /** Valore casuale che Discord restituisce identico: protegge da risposte non richieste. */
  readonly state: string;
}

/** Pagina di autorizzazione di Discord. prompt=none salta la conferma se l'utente ha già autorizzato l'app. */
export function buildAuthorizeUrl({ codeChallenge, state }: AuthorizeUrlOptions): string {
  const authorizeParameters = new URLSearchParams({
    client_id: DISCORD_CONFIG.applicationId,
    response_type: 'code',
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: DISCORD_CONFIG.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'none',
  });
  return `${DISCORD_AUTHORIZE_URL}?${authorizeParameters.toString()}`;
}

/**
 * Legge il ritorno da Discord (es. "/discord/callback?code=...&state=...") e restituisce il codice.
 * Rifiuta risposte con uno state diverso da quello inviato.
 */
export function readAuthorizationCode(redirectTarget: string, expectedState: string): string {
  const redirectParameters = new URL(redirectTarget, DISCORD_REDIRECT_URI).searchParams;

  if (redirectParameters.get('error') === 'access_denied') throw new AuthError('access-denied');
  if (redirectParameters.get('state') !== expectedState) throw new AuthError('unexpected');

  const authorizationCode = redirectParameters.get('code');
  if (!authorizationCode) throw new AuthError('unexpected');
  return authorizationCode;
}
