import { type ApiErrorCode, errorResponse } from '../http/jsonResponse';

/**
 * Siti esterni da cui l'Organizzazione aggiorna vetture e tracciati ("Aggiorna dati"): scaricamento iniettabile per i
 * test, errore comune quando un sito non risponde o cambia struttura, e flusso delle fonti salvate (ricalcolo
 * dell'anteprima e salvataggio riusano i dati dell'ultimo scaricamento).
 */

export type SourceFetch = (url: string, init?: RequestInit) => Promise<Response>;

export const defaultSourceFetch: SourceFetch = (url, init) => fetch(url, init);

/** unreachable = il sito non risponde; changed = risponde ma i dati non sono dove ce li aspettiamo. */
export type SourceErrorReason = 'unreachable' | 'changed';

/** Errore di una fonte: source dice quale (es. "official", "wiki"), così l'app può nominarla. */
export class ExternalSourceError<SourceName extends string = string> extends Error {
  constructor(
    readonly source: SourceName,
    readonly reason: SourceErrorReason,
    message: string,
  ) {
    super(message);
  }
}

/** Testo di una pagina; se il sito non risponde o risponde con un errore, l'errore della fonte con reason "unreachable". */
export async function fetchSourceText<SourceName extends string>(
  fetchSource: SourceFetch,
  url: string,
  headers: Readonly<Record<string, string>>,
  sourceError: (reason: SourceErrorReason, message: string) => ExternalSourceError<SourceName>,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchSource(url, { headers: { ...headers } });
  } catch (fetchError) {
    throw sourceError('unreachable', `${url}: ${String(fetchError)}`);
  }
  if (!response.ok) throw sourceError('unreachable', `${url}: HTTP ${response.status}`);
  return response.text();
}

/** apply e refetch del corpo di un aggiornamento: facoltativi, ma se ci sono devono essere booleani. null se non validi. */
export function readRefreshFlags(candidate: Readonly<Record<string, unknown>>): { readonly apply: boolean; readonly refetch: boolean } | null {
  const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
  if (!isOptionalBoolean(candidate.apply) || !isOptionalBoolean(candidate.refetch)) return null;
  // refetch di default sì: senza fonti salvate si scaricano comunque.
  return { apply: candidate.apply === true, refetch: candidate.refetch !== false };
}

interface RefreshSourcesOptions<Sources> {
  readonly refetch: boolean;
  readonly readStaged: () => Promise<Sources | null>;
  readonly fetchFresh: () => Promise<Sources>;
  readonly saveStaged: (sources: Sources) => Promise<void>;
  /** Per il registro degli errori ("Aggiornamento vetture"). */
  readonly logLabel: string;
  /** Codici d'errore dell'API per sito irraggiungibile o cambiato. */
  readonly errorCodes: Readonly<Record<SourceErrorReason, ApiErrorCode>>;
}

/**
 * Fonti di un aggiornamento: quelle salvate se non si chiede di riscaricarle (e ci sono), altrimenti scaricate e
 * salvate. Un sito che non risponde o è cambiato diventa una risposta 502 con il codice indicato e la fonte.
 */
export async function loadRefreshSources<Sources>(options: RefreshSourcesOptions<Sources>): Promise<Sources | Response> {
  const staged = options.refetch ? null : await options.readStaged();
  if (staged) return staged;
  let sources: Sources;
  try {
    sources = await options.fetchFresh();
  } catch (sourceError) {
    if (!(sourceError instanceof ExternalSourceError)) throw sourceError;
    console.error(options.logLabel, sourceError.source, sourceError.reason, sourceError.message);
    return errorResponse(502, options.errorCodes[sourceError.reason], { source: sourceError.source });
  }
  await options.saveStaged(sources);
  return sources;
}
