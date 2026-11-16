import { describe, expect, it } from 'vitest';
import { AuthError } from './authErrors';
import { buildAuthorizeUrl, readAuthorizationCode } from './authorizationRequest';

describe('richiesta di autorizzazione Discord', () => {
  it('costruisce la pagina di autorizzazione con PKCE, scope e indirizzo di ritorno locale', () => {
    const authorizeUrl = new URL(buildAuthorizeUrl({ codeChallenge: 'challenge', state: 'state-123' }));

    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(Object.fromEntries(authorizeUrl.searchParams)).toEqual({
      client_id: '1570595596836937748',
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:47823/discord/callback',
      scope: 'identify guilds.members.read',
      state: 'state-123',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      prompt: 'none',
    });
  });

  it('restituisce il codice quando lo state corrisponde', () => {
    expect(readAuthorizationCode('/discord/callback?code=abc&state=state-123', 'state-123')).toBe('abc');
  });

  it('rifiuta uno state diverso da quello inviato', () => {
    expect(() => readAuthorizationCode('/discord/callback?code=abc&state=altro', 'state-123')).toThrow(AuthError);
  });

  it("riconosce l'autorizzazione negata dall'utente", () => {
    try {
      readAuthorizationCode('/discord/callback?error=access_denied&state=state-123', 'state-123');
      expect.unreachable();
    } catch (caughtError) {
      expect((caughtError as AuthError).kind).toBe('access-denied');
    }
  });
});
