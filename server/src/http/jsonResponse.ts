/** Codici di errore restituiti all'app: l'app li traduce in messaggi nella lingua dell'utente. */
export type ApiErrorCode =
  | 'not-signed-in'
  | 'missing-role'
  | 'discord-unavailable'
  | 'invalid-request'
  | 'invalid-crew'
  | 'duplicate-crew-number'
  | 'duplicate-crew-name'
  | 'duplicate-crew-role'
  | 'crew-in-race-results'
  | 'invalid-race'
  | 'duplicate-race-round'
  | 'invalid-penalty'
  | 'invalid-ticket'
  | 'too-many-tickets'
  | 'tickets-closed'
  | 'ticket-already-resolved'
  | 'protest-already-reviewed'
  | 'protest-without-race'
  | 'no-crew-role'
  | 'multiple-crew-roles'
  | 'crew-not-found'
  | 'bot-unavailable'
  | 'invalid-protest'
  | 'too-many-protests'
  | 'invalid-video'
  | 'video-too-large'
  | 'video-already-uploaded'
  | 'upload-expired'
  | 'video-storage-unavailable'
  | 'youtube-already-added'
  | 'video-expired'
  | 'invalid-championship'
  | 'duplicate-championship-name'
  | 'championship-duration-in-use'
  | 'championship-has-races'
  | 'championship-car-in-use'
  | 'car-source-unreachable'
  | 'car-source-changed'
  | 'invalid-track'
  | 'duplicate-track'
  | 'not-found'
  | 'method-not-allowed'
  | 'unexpected';

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * PDF per il sito pubblico, con la stessa cache delle risposte JSON. Il nome del file vale sia per l'apertura
 * nella pagina sia per il download (ASCII semplice più la forma UTF-8 per gli accenti).
 */
export function publicPdfResponse(pdfBytes: Uint8Array, fileName: string): Response {
  const asciiName = fileName.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/"/g, '');
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}

/**
 * Risposta per il sito pubblico: i risultati cambiano di rado, quindi browser e rete di Cloudflare
 * possono tenerla per un minuto (e servirla scaduta mentre la riaggiornano).
 */
export function publicJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}

export function errorResponse(status: number, code: ApiErrorCode, details?: unknown): Response {
  return jsonResponse(status, { error: { code, ...(details !== undefined && { details }) } });
}
