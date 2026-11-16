import { describe, expect, it } from 'vitest';
import { createPkcePair, createRandomToken, deriveCodeChallenge } from './pkce';

describe('PKCE', () => {
  it("deriva il code_challenge dell'esempio ufficiale RFC 7636", async () => {
    expect(await deriveCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('genera verifier validi (43–128 caratteri URL-safe) e sempre diversi', async () => {
    const firstPair = await createPkcePair();
    const secondPair = await createPkcePair();

    expect(firstPair.codeVerifier).toMatch(/^[\w-]{43,128}$/);
    expect(firstPair.codeVerifier).not.toBe(secondPair.codeVerifier);
    expect(firstPair.codeChallenge).toBe(await deriveCodeChallenge(firstPair.codeVerifier));
  });

  it('genera state casuali URL-safe', () => {
    expect(createRandomToken()).toMatch(/^[\w-]{43}$/);
  });
});
