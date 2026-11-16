/** PKCE (RFC 7636): sostituisce il client secret nelle app che non possono custodirlo. */

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

/** Stringa casuale crittograficamente sicura, adatta per URL. */
export function createRandomToken(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** code_challenge = BASE64URL(SHA-256(code_verifier)). */
export async function deriveCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest));
}

export interface PkcePair {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
}

/** Nuova coppia per ogni tentativo di login: il verifier non lascia mai l'app fino allo scambio del codice. */
export async function createPkcePair(): Promise<PkcePair> {
  const codeVerifier = createRandomToken(48);
  return { codeVerifier, codeChallenge: await deriveCodeChallenge(codeVerifier) };
}
