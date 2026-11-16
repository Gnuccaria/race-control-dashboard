/**
 * Discord risponde 429 ("troppe richieste") quando lo si interroga troppo spesso, per esempio quando il sito
 * apre una pagina e manda insieme più richieste (profilo, equipaggio, ticket, campanella). Se l'attesa chiesta
 * da Discord è breve si aspetta e si riprova; altrimenti si restituisce la risposta 429 a chi chiama.
 */

const MAX_RETRY_WAIT_MS = 3000;
const MAX_RETRIES = 2;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Attesa chiesta da Discord in millisecondi (corpo `retry_after` in secondi, o intestazione Retry-After). */
async function retryAfterMs(response: Response): Promise<number> {
  try {
    const body = (await response.clone().json()) as { retry_after?: unknown };
    if (typeof body.retry_after === 'number' && Number.isFinite(body.retry_after)) return Math.ceil(body.retry_after * 1000);
  } catch {
    // Corpo non JSON: si usa l'intestazione.
  }
  const header = Number(response.headers.get('Retry-After'));
  return Number.isFinite(header) && header >= 0 ? Math.ceil(header * 1000) : Number.POSITIVE_INFINITY;
}

export async function fetchWithDiscordRetry(discordFetch: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  let response = await discordFetch(url, init);
  for (let attempt = 0; attempt < MAX_RETRIES && response.status === 429; attempt += 1) {
    const waitMs = await retryAfterMs(response);
    if (waitMs > MAX_RETRY_WAIT_MS) break;
    await wait(waitMs + 50);
    response = await discordFetch(url, init);
  }
  return response;
}

export async function hashToken(accessToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
