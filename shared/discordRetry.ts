/**
 * Chiamate a Discord con nuovi tentativi per gli errori passeggeri, condivise da app (fetch di Tauri) e server
 * (fetch dei Worker).
 *
 * - 429 "troppe richieste": Discord dice quanto aspettare (`retry_after` nel corpo JSON, o le intestazioni
 *   Retry-After / X-RateLimit-Reset-After). Se l'attesa è entro il limite si aspetta e si riprova.
 *   Un 429 senza corpo JSON di Discord arriva dal firewall di Cloudflare davanti a Discord (succede soprattutto
 *   dai Worker, che escono da IP condivisi): si riprova dopo un'attesa fissa, perché la richiesta successiva
 *   può uscire da un altro indirizzo.
 * - 500/502/503/504 (e gli errori di rete): si riprova solo se la richiesta si può ripetere senza effetti
 *   (retryServerErrors), per esempio una lettura: uno scambio di codice o un messaggio non vanno ripetuti.
 *   Un 429 invece si può sempre ripetere: Discord non ha eseguito la richiesta.
 */

/** Funzione fetch minima: basta che restituisca una risposta con status, intestazioni e corpo clonabile. */
export type DiscordFetchFunction = (url: string, init: RequestInit) => Promise<Response>;

export interface DiscordRetryOptions {
  /** Attesa massima accettata per un singolo nuovo tentativo; oltre si restituisce la risposta 429. */
  readonly maxWaitMs?: number;
  /** Nuovi tentativi al massimo (oltre alla prima richiesta). */
  readonly maxRetries?: number;
  /** Ripetere anche dopo un errore del server di Discord o di rete (solo richieste ripetibili). */
  readonly retryServerErrors?: boolean;
  /** Per i test: attesa simulata. */
  readonly wait?: (milliseconds: number) => Promise<void>;
}

/** Attese per i 429 senza indicazioni di Discord e per gli errori del server, tentativo dopo tentativo. */
const FALLBACK_WAITS_MS = [1000, 2500, 4000];
const RETRYABLE_SERVER_STATUSES = new Set([500, 502, 503, 504]);

const defaultWait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Attesa chiesta da Discord in millisecondi; null se la risposta non arriva dall'API di Discord (es. firewall). */
export async function discordRetryAfterMs(response: Response): Promise<number | null> {
  try {
    const body = (await response.clone().json()) as { retry_after?: unknown };
    if (typeof body.retry_after === 'number' && Number.isFinite(body.retry_after)) return Math.ceil(body.retry_after * 1000);
  } catch {
    // Corpo non JSON: si guardano le intestazioni.
  }
  for (const header of ['Retry-After', 'X-RateLimit-Reset-After']) {
    const value = response.headers.get(header);
    const seconds = value === null || value.trim() === '' ? Number.NaN : Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  }
  return null;
}

/** Breve descrizione di una risposta di errore per i log (mai token né dati personali). */
export const describeDiscordFailure = (response: Response, path: string): string =>
  `Discord ${response.status} su ${path}${response.headers.get('X-RateLimit-Scope') ? ` (limite: ${response.headers.get('X-RateLimit-Scope')})` : ''}`;

export async function fetchDiscordWithRetry(
  fetchFunction: DiscordFetchFunction,
  url: string,
  init: RequestInit,
  { maxWaitMs = 3000, maxRetries = 2, retryServerErrors = false, wait = defaultWait }: DiscordRetryOptions = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const isLastAttempt = attempt >= maxRetries;
    let response: Response;
    try {
      response = await fetchFunction(url, init);
    } catch (networkError) {
      if (!retryServerErrors || isLastAttempt) throw networkError;
      await wait(FALLBACK_WAITS_MS[attempt] ?? FALLBACK_WAITS_MS.at(-1) ?? 1000);
      continue;
    }

    let waitMs: number | null = null;
    if (response.status === 429) waitMs = (await discordRetryAfterMs(response)) ?? FALLBACK_WAITS_MS[attempt] ?? null;
    else if (retryServerErrors && RETRYABLE_SERVER_STATUSES.has(response.status)) waitMs = FALLBACK_WAITS_MS[attempt] ?? null;

    if (waitMs === null || isLastAttempt || waitMs > maxWaitMs) return response;
    await wait(waitMs + 50);
  }
}
