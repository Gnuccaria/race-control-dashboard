import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { CREW_API_URL } from '@/config/apiConfig';
import { getSessionAccessToken } from '@/features/auth/authSessionStore';
import type { Messages } from '@/i18n/messages';

/** Ogni errore che il server (o la rete) può restituire ha un messaggio in messages.serverErrors. */
export type ServerErrorKind = keyof Messages['serverErrors'];

export type ServerApiResult<Value> =
  | { readonly isSuccess: true; readonly value: Value }
  | { readonly isSuccess: false; readonly errorKind: ServerErrorKind };

/** Codici di errore del server (server/src/http/jsonResponse.ts) → messaggi mostrati nell'app. */
const ERROR_KIND_BY_SERVER_CODE: Record<string, ServerErrorKind> = {
  'duplicate-crew-number': 'duplicate-number',
  'duplicate-crew-name': 'duplicate-name',
  'duplicate-crew-role': 'duplicate-role',
  'invalid-crew': 'invalid-crew',
  'invalid-request': 'invalid-crew',
  'crew-in-race-results': 'crew-in-race-results',
  'invalid-race': 'invalid-race',
  'duplicate-race-round': 'duplicate-race-round',
  'invalid-penalty': 'invalid-penalty',
  'invalid-championship': 'invalid-championship',
  'duplicate-championship-name': 'duplicate-championship-name',
  'championship-duration-in-use': 'championship-duration-in-use',
  'championship-has-races': 'championship-has-races',
  'championship-car-in-use': 'championship-car-in-use',
  'car-source-unreachable': 'car-source-unreachable',
  'car-source-changed': 'car-source-changed',
  'track-source-unreachable': 'track-source-unreachable',
  'track-source-changed': 'track-source-changed',
  'invalid-weather': 'invalid-weather',
  'not-signed-in': 'not-signed-in',
  'missing-role': 'missing-role',
  'discord-unavailable': 'discord-unavailable',
  'not-found': 'not-found',
  'invalid-ticket': 'invalid-ticket',
  'ticket-already-resolved': 'ticket-already-resolved',
  'protest-already-reviewed': 'protest-already-reviewed',
  'protest-without-race': 'protest-without-race',
  'video-expired': 'video-expired',
  'invalid-protest': 'invalid-protest',
};

let lastUnexpectedDetail: string | null = null;

/**
 * Dettaglio dell'ultima risposta imprevista (es. "POST /championships → HTTP 405, risposta non JSON"): l'app lo
 * aggiunge al messaggio "errore imprevisto" (serverErrorText), così si capisce cosa è successo senza strumenti.
 */
export const getLastUnexpectedDetail = (): string | null => lastUnexpectedDetail;

function unexpectedResult(request: Pick<ServerApiRequest, 'method' | 'path'>, status: number, code: string | undefined | null) {
  lastUnexpectedDetail = `${request.method} ${request.path} → HTTP ${status}${code ? ` ${code}` : code === null ? ', risposta non JSON' : ''}`;
  console.error('Risposta imprevista del server', lastUnexpectedDetail);
  return { isSuccess: false, errorKind: 'unexpected' } as const;
}

/** Codice d'errore del server; null se la risposta non è JSON (es. una pagina del sito al posto dell'API). */
async function readServerErrorCode(errorResponse: Response): Promise<string | undefined | null> {
  try {
    const errorBody = (await errorResponse.json()) as { error?: { code?: string } };
    return errorBody.error?.code;
  } catch {
    return null;
  }
}

export interface ServerApiRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
}

/**
 * Unico punto di contatto con il server (equipaggi, gare, piste). Il token Discord della sessione permette
 * al server di verificare il ruolo; la chiamata passa dal lato nativo di Tauri (nessun blocco CORS).
 */
export async function requestServerApi<Value>(
  { method, path, body }: ServerApiRequest,
  readValue: (responseBody: unknown) => Value,
): Promise<ServerApiResult<Value>> {
  const accessToken = getSessionAccessToken();
  if (!accessToken) return { isSuccess: false, errorKind: 'not-signed-in' };

  let serverResponse: Response;
  try {
    serverResponse = await tauriFetch(`${CREW_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (networkError) {
    // Il dettaglio (es. connessione rifiutata, indirizzo non permesso) resta negli strumenti per sviluppatori.
    console.error(`Server non raggiungibile su ${CREW_API_URL}`, networkError);
    return { isSuccess: false, errorKind: 'server-unreachable' };
  }

  if (serverResponse.ok) {
    // 204 (es. risultato di un ticket) non ha corpo: niente JSON da leggere.
    let responseBody: unknown;
    try {
      responseBody = serverResponse.status === 204 ? undefined : await serverResponse.json();
    } catch {
      return unexpectedResult({ method, path }, serverResponse.status, null);
    }
    return { isSuccess: true, value: readValue(responseBody) };
  }

  const serverErrorCode = await readServerErrorCode(serverResponse);
  const errorKind = serverErrorCode ? ERROR_KIND_BY_SERVER_CODE[serverErrorCode] : undefined;
  return errorKind ? { isSuccess: false, errorKind } : unexpectedResult({ method, path }, serverResponse.status, serverErrorCode);
}

/** Lettore della risposta delle eliminazioni multiple: { deletedCount }. */
export const readDeletedCount = (responseBody: unknown) => (responseBody as { deletedCount: number }).deletedCount;

/**
 * File dal server (es. il video di una protesta), con la stessa autorizzazione delle altre richieste: un <video>
 * non può mandare il token, quindi l'app lo scarica e lo riproduce dalla memoria.
 */
export async function requestServerBlob(path: string): Promise<ServerApiResult<Blob>> {
  const accessToken = getSessionAccessToken();
  if (!accessToken) return { isSuccess: false, errorKind: 'not-signed-in' };
  let serverResponse: Response;
  try {
    serverResponse = await tauriFetch(`${CREW_API_URL}${path}`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (networkError) {
    console.error(`Server non raggiungibile su ${CREW_API_URL}`, networkError);
    return { isSuccess: false, errorKind: 'server-unreachable' };
  }
  if (serverResponse.ok) return { isSuccess: true, value: await serverResponse.blob() };
  const serverErrorCode = await readServerErrorCode(serverResponse);
  const errorKind = serverErrorCode ? ERROR_KIND_BY_SERVER_CODE[serverErrorCode] : undefined;
  return errorKind ? { isSuccess: false, errorKind } : unexpectedResult({ method: 'GET', path }, serverResponse.status, serverErrorCode);
}
