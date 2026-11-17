import type { TicketCrewOption, TicketCrewProblem } from '@shared/disconnectionTicketRules';
import type { ProtestCrew, ProtestDraftIssues, ProtestRaceOption, SiteProtest } from '@shared/protestRules';
import { API_BASE_URL } from './publicRaces';

/** Motivi per cui una richiesta sulle proteste non va: accesso, equipaggio, dati, limite, video, rete. */
export type ProtestRequestProblem =
  | 'signed-out'
  | 'not-guild-member'
  | TicketCrewProblem
  | 'invalid'
  | 'too-many-protests'
  | 'not-found'
  | 'already-added'
  | 'expired'
  | 'unavailable';

/** Motivi per cui il video non è stato caricato (la protesta è comunque stata inviata). */
export type VideoUploadProblem = 'too-large' | 'invalid-type' | 'expired' | 'already-added' | 'storage-unavailable' | 'unavailable';

export type ProtestRequestResult<Value> =
  | { readonly isSuccess: true; readonly value: Value }
  | { readonly isSuccess: false; readonly problem: ProtestRequestProblem; readonly issues?: ProtestDraftIssues };

/** Dati del modulo: equipaggio di chi è entrato (dal ruolo Discord) e gli altri equipaggi del suo campionato. */
export interface ProtestFormData {
  readonly crew: TicketCrewOption;
  /** Equipaggi di tutti i campionati (escluso il proprio): il modulo mostra quelli del campionato scelto. */
  /** Gare del campionato dell'equipaggio che accettano proteste, dalla più recente. */
  readonly races: readonly ProtestRaceOption[];
  /** Equipaggi del campionato (escluso il proprio). */
  readonly otherCrews: readonly (ProtestCrew & { readonly color: string | null })[];
}

/** Dati della protesta come li manda il modulo (il link YouTube lo converte il server). */
export interface ProtestSubmission {
  readonly raceId: number;
  readonly stint: number;
  readonly lap: number;
  readonly corner: string;
  readonly description: string;
  readonly youtubeUrl: string;
  readonly otherCrewIds: readonly number[];
}

const CREW_PROBLEMS: readonly string[] = ['no-crew-role', 'multiple-crew-roles', 'crew-not-found', 'bot-unavailable'];
type ErrorBody = { error?: { code?: string; details?: ProtestDraftIssues } } | null;
const DISCORD_RETRY_DELAY_MS = 2000;

async function requestProtests<Value>(accessToken: string, path: string, init: RequestInit, read: (body: unknown) => Value): Promise<ProtestRequestResult<Value>> {
  const send = async () => {
    const response = await fetch(`${API_BASE_URL}/public/protests${path}`, {
      ...init,
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers },
    });
    return { response, body: (await response.json().catch(() => null)) as ErrorBody };
  };
  let response: Response;
  let body: ErrorBody;
  try {
    ({ response, body } = await send());
    // Discord non ha risposto alla verifica dell'accesso: la richiesta non è stata eseguita, si può riprovare.
    if (response.status === 503 && body?.error?.code === 'discord-unavailable') {
      await new Promise((resolve) => setTimeout(resolve, DISCORD_RETRY_DELAY_MS));
      ({ response, body } = await send());
    }
  } catch {
    return { isSuccess: false, problem: 'unavailable' };
  }
  if (response.ok && body) return { isSuccess: true, value: read(body) };
  const code = body?.error?.code ?? '';
  if (CREW_PROBLEMS.includes(code)) return { isSuccess: false, problem: code as TicketCrewProblem };
  if (response.status === 401) return { isSuccess: false, problem: 'signed-out' };
  if (response.status === 403) return { isSuccess: false, problem: 'not-guild-member' };
  if (response.status === 404) return { isSuccess: false, problem: 'not-found' };
  if (response.status === 409) return { isSuccess: false, problem: code === 'upload-expired' ? 'expired' : 'already-added' };
  if (response.status === 429) return { isSuccess: false, problem: 'too-many-protests' };
  if (response.status === 422) return { isSuccess: false, problem: 'invalid', ...(body?.error?.details && { issues: body.error.details }) };
  return { isSuccess: false, problem: 'unavailable' };
}

export const fetchProtestForm = (accessToken: string) => requestProtests(accessToken, '/form', {}, (body) => body as ProtestFormData);

/** Invia la protesta; restituisce il suo numero. */
export const submitProtest = (accessToken: string, protest: ProtestSubmission) =>
  requestProtests(
    accessToken,
    '',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(protest) },
    (body) => (body as { protest: { id: number } }).protest.id,
  );

/** Proteste di chi è entrato e del suo equipaggio, con l'esito. */
export const fetchMyProtests = (accessToken: string) =>
  requestProtests(accessToken, '/mine', {}, (body) => (body as { protests: SiteProtest[] }).protests);

export const fetchMyProtest = (accessToken: string, protestId: number) =>
  requestProtests(accessToken, `/${protestId}`, {}, (body) => (body as { protest: SiteProtest }).protest);

/** Aggiunge il link YouTube (entro 24 ore dall'invio, solo chi l'ha mandata). */
export const addProtestYoutube = (accessToken: string, protestId: number, youtubeUrl: string) =>
  requestProtests(
    accessToken,
    `/${protestId}/youtube`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youtubeUrl }) },
    (body) => (body as { protest: SiteProtest }).protest,
  );

/** Il video caricato, da riprodurre nella pagina (un <video> non può mandare il token: lo si scarica). */
export async function fetchProtestVideoBlob(accessToken: string, protestId: number): Promise<Blob | 'expired' | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/protests/${protestId}/video`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 410) return 'expired';
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Carica il video della protesta (entro 24 ore dall'invio, solo chi l'ha mandata). Usa XMLHttpRequest (e non fetch) per poter mostrare la
 * percentuale di caricamento: onProgress riceve un numero da 0 a 1.
 */
export function uploadProtestVideo(
  accessToken: string,
  protestId: number,
  video: File,
  onProgress: (fraction: number) => void,
): Promise<{ readonly isSuccess: true } | { readonly isSuccess: false; readonly problem: VideoUploadProblem | 'signed-out' }> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open('PUT', `${API_BASE_URL}/public/protests/${protestId}/video`);
    request.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    request.setRequestHeader('Content-Type', video.type);
    request.upload.addEventListener('progress', (progressEvent) => {
      if (progressEvent.lengthComputable) onProgress(progressEvent.loaded / progressEvent.total);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve({ isSuccess: true });
      else if (request.status === 401) resolve({ isSuccess: false, problem: 'signed-out' });
      else if (request.status === 413) resolve({ isSuccess: false, problem: 'too-large' });
      else if (request.status === 422) resolve({ isSuccess: false, problem: 'invalid-type' });
      else if (request.status === 409) resolve({ isSuccess: false, problem: request.responseText.includes('upload-expired') ? 'expired' : 'already-added' });
      // 503: bucket dei video non configurato, oppure Discord non ha risposto alla verifica dell'accesso.
      else if (request.status === 503) resolve({ isSuccess: false, problem: request.responseText.includes('video-storage-unavailable') ? 'storage-unavailable' : 'unavailable' });
      else resolve({ isSuccess: false, problem: 'unavailable' });
    });
    request.addEventListener('error', () => resolve({ isSuccess: false, problem: 'unavailable' }));
    request.send(video);
  });
}
