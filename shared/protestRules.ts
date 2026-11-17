import type { CrewChampionship } from './crewRules';
import { type PenaltyCrewDecision, type PenaltyDocument, type PenaltyDraft, type PenaltyDraftIssues, validatePenaltyDraft } from './penaltyRules';

/**
 * Regole delle proteste mandate dal sito e lette dai Commissari Sportivi nell'app, condivise da sito, server e app:
 * il sito le usa per guidare l'utente, il server per non fidarsi mai di ciò che riceve.
 */

export const PROTEST_STINT_MIN = 1;
export const PROTEST_STINT_MAX = 20;
export const PROTEST_LAP_MIN = 1;
export const PROTEST_LAP_MAX = 999;
export const PROTEST_CORNER_MAX_LENGTH = 40;
export const PROTEST_DESCRIPTION_MAX_LENGTH = 500;
/** Il contatore dei caratteri rimasti compare quando ne mancano al massimo tanti. */
export const PROTEST_DESCRIPTION_COUNTER_FROM = 50;
export const PROTEST_OTHER_CREWS_MAX = 20;
/** Proteste che una persona può mandare in 24 ore. */
export const MAX_PROTESTS_PER_DAY = 10;
/** Video: al massimo 100 MB (limite di una richiesta a Cloudflare Workers), nei formati che i browser riproducono. */
export const PROTEST_VIDEO_MAX_BYTES = 100_000_000;
export const PROTEST_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export type ProtestVideoType = (typeof PROTEST_VIDEO_TYPES)[number];
export const isProtestVideoType = (value: unknown): value is ProtestVideoType => PROTEST_VIDEO_TYPES.some((type) => type === value);
/** Video caricato o link YouTube si possono aggiungere fino a 24 ore dall'invio della protesta, poi non più. */
export const PROTEST_VIDEO_WINDOW_MS = 24 * 60 * 60 * 1000;
/** I video caricati si cancellano da soli 30 giorni dopo l'invio della protesta (regola del bucket R2). */
export const PROTEST_VIDEO_RETENTION_DAYS = 30;
export const PROTEST_VIDEO_RETENTION_MS = PROTEST_VIDEO_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const PROTEST_REJECTION_REASON_MAX_LENGTH = 500;

/** Fino a quando si possono aggiungere video alla protesta. */
export const protestVideoDeadline = (createdAt: string): Date => new Date(new Date(createdAt).getTime() + PROTEST_VIDEO_WINDOW_MS);
export const isProtestVideoWindowOpen = (createdAt: string, now = Date.now()): boolean => protestVideoDeadline(createdAt).getTime() > now;
export const isProtestVideoExpired = (createdAt: string, now = Date.now()): boolean =>
  new Date(createdAt).getTime() + PROTEST_VIDEO_RETENTION_MS < now;

/** In esame finché i Commissari non decidono: respinta oppure accolta (con una penalità). Entrambe definitive. */
export type ProtestStatus = 'open' | 'rejected' | 'accepted';

/** Gara della protesta, come la mostrano app e sito. */
export interface ProtestRace {
  readonly id: number;
  readonly name: string | null;
  readonly round: number;
  readonly championship: CrewChampionship;
}

/** Gara tra cui scegliere nel modulo del sito: accetta proteste ed è del campionato dell'equipaggio. */
export interface ProtestRaceOption extends ProtestRace {
  readonly raceDate: string;
}

/** Penalità decisa accogliendo la protesta (salvata tra le penalità della gara, va nel referto PDF). */
export interface ProtestPenalty {
  readonly id: number;
  readonly crews: readonly PenaltyCrewDecision[];
  readonly violation: string;
  readonly document: PenaltyDocument;
  readonly reason: string;
}

/** Equipaggio come compare in una protesta (copiato all'invio: resta leggibile anche se l'equipaggio cambia). */
export interface ProtestCrew {
  readonly id: number;
  readonly number: number;
  readonly name: string;
}

/** Dati della protesta scritti dal pilota; l'equipaggio coinvolto lo ricava il server dal ruolo Discord. */
export interface ProtestDraft {
  /** Gara dell'episodio (deve accettare proteste ed essere del campionato dell'equipaggio): da qui il campionato
   * e gli altri equipaggi coinvolti. */
  readonly raceId: number;
  readonly stint: number;
  readonly lap: number;
  readonly corner: string;
  /** Descrizione dell'episodio; '' = non scritta. */
  readonly description: string;
  /** ID del video YouTube (11 caratteri); null = nessun link. */
  readonly youtubeVideoId: string | null;
  readonly otherCrewIds: readonly number[];
}

/** Protesta salvata, come la leggono i Commissari nell'app. */
export interface Protest {
  readonly id: number;
  readonly crew: ProtestCrew;
  readonly championship: string | null;
  /** null per le proteste mandate prima che si scegliesse la gara (hanno solo il campionato). */
  readonly race: ProtestRace | null;
  readonly stint: number;
  readonly lap: number;
  readonly corner: string;
  readonly description: string;
  readonly youtubeVideoId: string | null;
  readonly otherCrews: readonly ProtestCrew[];
  /**
   * Video caricato dal sito (si scarica a parte); null = nessun video. isExpired: passati 30 giorni dall'invio,
   * il video è stato (o sta per essere) cancellato in automatico.
   */
  readonly video: { readonly contentType: ProtestVideoType; readonly size: number; readonly isExpired: boolean } | null;
  readonly status: ProtestStatus;
  /** Motivazione del rifiuto; null se la protesta non è respinta (prima era facoltativa: può essere ''). */
  readonly rejectionReason: string | null;
  /** Penalità decisa accogliendo la protesta; null se non è accolta. */
  readonly penalty: ProtestPenalty | null;
  /** Quando i Commissari hanno salvato l'esito; null se mai. */
  readonly reviewedAt: string | null;
  readonly submittedByName: string;
  readonly submittedByUsername: string;
  readonly createdAt: string;
}

export interface ProtestDraftIssues {
  readonly raceId?: 'required' | 'invalid';
  readonly stint?: 'required' | 'invalid';
  readonly lap?: 'required' | 'invalid';
  readonly corner?: 'required' | 'invalid';
  readonly description?: 'too-long';
  readonly youtubeUrl?: 'invalid';
  readonly otherCrewIds?: 'invalid';
}

export type ProtestDraftValidation =
  | { readonly isValid: true; readonly protest: ProtestDraft }
  | { readonly isValid: false; readonly issues: ProtestDraftIssues };

const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * ID del video da un link YouTube: youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/…, /embed/….
 * null se il testo non è un link a un video YouTube.
 */
export function youtubeVideoIdFrom(linkText: string): string | null {
  const text = linkText.trim();
  if (text === '') return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let videoId: string | null | undefined = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') videoId = url.pathname.split('/')[1];
  else if (YOUTUBE_HOSTS.has(host)) {
    const [, section, pathId] = url.pathname.split('/');
    videoId = section === 'watch' ? url.searchParams.get('v') : ['shorts', 'live', 'embed'].includes(section ?? '') ? pathId : null;
  }
  return videoId && YOUTUBE_ID_PATTERN.test(videoId) ? videoId : null;
}

/** Testo su una riga: spazi multipli ridotti a uno, niente caratteri di controllo. */
export const normalizeProtestCorner = (rawText: string): string => rawText.normalize('NFC').replace(/\s+/g, ' ').trim();

/** Descrizione: a capo uniformati, spazi in fondo tolti. */
export const normalizeProtestDescription = (rawText: string): string => rawText.normalize('NFC').replace(/\r\n?/g, '\n').trimEnd();

const isIntegerBetween = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/** Convalida dati di origine sconosciuta (es. il corpo JSON della richiesta) e li restituisce in forma canonica. */
export function validateProtestDraft(input: unknown): ProtestDraftValidation {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const issues: { -readonly [Key in keyof ProtestDraftIssues]: ProtestDraftIssues[Key] } = {};

  const { raceId, stint, lap } = candidate;
  if (raceId === undefined || raceId === null || raceId === '') issues.raceId = 'required';
  else if (!isIntegerBetween(raceId, 1, Number.MAX_SAFE_INTEGER)) issues.raceId = 'invalid';
  if (stint === undefined || stint === null) issues.stint = 'required';
  else if (!isIntegerBetween(stint, PROTEST_STINT_MIN, PROTEST_STINT_MAX)) issues.stint = 'invalid';
  if (lap === undefined || lap === null) issues.lap = 'required';
  else if (!isIntegerBetween(lap, PROTEST_LAP_MIN, PROTEST_LAP_MAX)) issues.lap = 'invalid';

  const corner = typeof candidate.corner === 'string' ? normalizeProtestCorner(candidate.corner) : '';
  if (corner === '') issues.corner = 'required';
  else if ([...corner].length > PROTEST_CORNER_MAX_LENGTH || /\p{Cc}/u.test(corner)) issues.corner = 'invalid';

  const description = typeof candidate.description === 'string' ? normalizeProtestDescription(candidate.description) : '';
  if (description.length > PROTEST_DESCRIPTION_MAX_LENGTH) issues.description = 'too-long';

  const youtubeText = typeof candidate.youtubeUrl === 'string' ? candidate.youtubeUrl.trim() : '';
  const youtubeVideoId = youtubeText === '' ? null : youtubeVideoIdFrom(youtubeText);
  if (youtubeText !== '' && youtubeVideoId === null) issues.youtubeUrl = 'invalid';

  const rawCrewIds = candidate.otherCrewIds ?? [];
  const otherCrewIds = Array.isArray(rawCrewIds) ? rawCrewIds : null;
  if (
    !otherCrewIds ||
    otherCrewIds.length > PROTEST_OTHER_CREWS_MAX ||
    otherCrewIds.some((crewId) => !isIntegerBetween(crewId, 1, Number.MAX_SAFE_INTEGER)) ||
    new Set(otherCrewIds).size !== otherCrewIds.length
  ) {
    issues.otherCrewIds = 'invalid';
  }

  if (Object.keys(issues).length > 0) return { isValid: false, issues };
  return {
    isValid: true,
    protest: {
      raceId: raceId as number,
      stint: stint as number,
      lap: lap as number,
      corner,
      description,
      youtubeVideoId,
      otherCrewIds: otherCrewIds as number[],
    },
  };
}

/** Indirizzo del player YouTube "privacy avanzata" (nessun cookie finché non si preme play). */
export const youtubeEmbedUrl = (videoId: string) => `https://www.youtube-nocookie.com/embed/${videoId}`;
export const youtubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

/**
 * Protesta come la vede il sito (chi l'ha mandata e il suo equipaggio): dell'esito solo lo stato (in esame,
 * accolta, respinta), senza motivazione né penalità; e cosa può ancora aggiungere chi guarda.
 */
export interface SiteProtest extends Omit<Protest, 'rejectionReason' | 'penalty'> {
  /** Chi guarda l'ha mandata, sono passate meno di 24 ore e non c'è ancora un video caricato. */
  readonly canAddVideo: boolean;
  /** Come sopra, per il link YouTube. */
  readonly canAddYoutube: boolean;
}

/**
 * Esito salvato dai Commissari, definitivo (il server rifiuta un secondo esito con 409):
 * - respinta: la motivazione è obbligatoria;
 * - accolta: una penalità come quelle della gara, con le vetture coinvolte già decise (l'equipaggio della protesta
 *   e gli altri equipaggi coinvolti, ognuno con la sua decisione facoltativa); violazione, documento e motivazione
 *   obbligatori. La penalità si salva tra quelle della gara (referto PDF, traduzione inglese automatica).
 */
export type ProtestReview =
  | { readonly decision: 'rejected'; readonly reason: string }
  | { readonly decision: 'accepted'; readonly penalty: Omit<PenaltyDraft, 'englishText'> };

export interface ProtestReviewIssues {
  readonly decision?: 'invalid';
  readonly reason?: 'required' | 'too-long';
  readonly penalty?: Omit<PenaltyDraftIssues, 'reason' | 'crews'> & {
    readonly reason?: 'required' | 'too-long' | 'invalid';
    readonly crews?: 'required' | 'invalid' | 'not-protest-crews';
  };
}

export type ProtestReviewValidation = { readonly isValid: true; readonly review: ProtestReview } | { readonly isValid: false; readonly issues: ProtestReviewIssues };

/** Si decide solo su una protesta ancora in esame. */
export const canReviewProtest = (status: ProtestStatus): boolean => status === 'open';

/** Vetture coinvolte di una protesta: l'equipaggio che l'ha mandata e gli altri equipaggi indicati, senza ripetizioni. */
export const protestCrewIds = (protest: Pick<Protest, 'crew' | 'otherCrews'>): number[] => [...new Set([protest.crew.id, ...protest.otherCrews.map((crew) => crew.id)])];

/** Convalida l'esito; protestCrews = le vetture coinvolte della protesta (protestCrewIds), che la penalità deve avere. */
export function validateProtestReview(input: unknown, protestCrews: readonly number[]): ProtestReviewValidation {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  if (candidate.decision === 'rejected') {
    const reason = typeof candidate.reason === 'string' ? normalizeProtestDescription(candidate.reason).trim() : '';
    if (reason === '') return { isValid: false, issues: { reason: 'required' } };
    if (reason.length > PROTEST_REJECTION_REASON_MAX_LENGTH) return { isValid: false, issues: { reason: 'too-long' } };
    return { isValid: true, review: { decision: 'rejected', reason } };
  }
  if (candidate.decision !== 'accepted') return { isValid: false, issues: { decision: 'invalid' } };

  const penaltyInput = typeof candidate.penalty === 'object' && candidate.penalty !== null ? { ...(candidate.penalty as Record<string, unknown>) } : {};
  delete penaltyInput.englishText;
  const validation = validatePenaltyDraft(penaltyInput);
  const issues: { -readonly [Field in keyof NonNullable<ProtestReviewIssues['penalty']>]: NonNullable<ProtestReviewIssues['penalty']>[Field] } = validation.isValid
    ? {}
    : { ...validation.issues };
  if (validation.isValid && validation.penalty.reason === '') issues.reason = 'required';
  if (validation.isValid) {
    const crewIds = validation.penalty.crews.map((crew) => crew.crewId).sort((first, second) => first - second);
    const expected = [...protestCrews].sort((first, second) => first - second);
    if (crewIds.length !== expected.length || crewIds.some((crewId, index) => crewId !== expected[index])) issues.crews = 'not-protest-crews';
  }
  if (!validation.isValid || Object.keys(issues).length > 0) return { isValid: false, issues: { penalty: issues } };
  const { crews, violation, document, reason } = validation.penalty;
  return { isValid: true, review: { decision: 'accepted', penalty: { crews, violation, document, reason } } };
}
