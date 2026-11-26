/**
 * Penalità decise dalla Direzione Gara per una gara: vetture coinvolte, ognuna con la sua decisione (facoltativa),
 * violazione e motivazione. Se nessuna vettura ha una decisione, nel referto vale "Nessuna azione ulteriore".
 * Regole usate sia dall'app sia dal server.
 */
import { fieldsOf, isPositiveInteger } from './valueRules';

/** Secondi aggiunti al tempo di gara. */
const TIME_DECISIONS = ['time-5', 'time-10', 'time-20', 'time-30', 'time-60', 'time-120', 'time-300'] as const;
/** Posizioni perse in griglia di partenza nel round successivo. */
const GRID_DECISIONS = ['grid-1', 'grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6', 'grid-7'] as const;

/** Decisioni possibili per una vettura, nell'ordine del menu (dalla più lieve alla più grave). */
export const PENALTY_DECISIONS = [
  'reprimand',
  ...TIME_DECISIONS,
  ...GRID_DECISIONS,
  'race-disqualification',
  'championship-disqualification',
] as const;
export type PenaltyDecision = (typeof PENALTY_DECISIONS)[number];

export const isPenaltyDecision = (value: unknown): value is PenaltyDecision =>
  PENALTY_DECISIONS.some((decision) => decision === value);

/** Secondi aggiunti dalle decisioni a tempo (null per le altre). */
export function penaltySeconds(decision: PenaltyDecision): number | null {
  const match = /^time-(\d+)$/.exec(decision);
  return match ? Number(match[1]) : null;
}

/** Posizioni di penalità in griglia (null per le altre decisioni). */
export function penaltyGridPositions(decision: PenaltyDecision): number | null {
  const match = /^grid-(\d+)$/.exec(decision);
  return match ? Number(match[1]) : null;
}

/*
 * Reprimende: vanno alla vettura e contano tutte uguali. Si numerano in ordine (gare del campionato per data
 * e round, poi ordine di inserimento): alla terza scatta da sola +1 posizione in griglia di partenza nella
 * gara successiva e il conteggio riparte da zero.
 */
export const REPRIMANDS_PER_GRID_PENALTY = 3;
/** Posizioni in griglia date in automatico alla terza reprimenda. */
export const REPRIMAND_GRID_POSITIONS = 1;

/** n-esima reprimenda di una vettura (dalla prima del campionato) → numero nel ciclo corrente, da 1 a 3. */
export const reprimandCycleNumber = (ordinal: number): number => ((ordinal - 1) % REPRIMANDS_PER_GRID_PENALTY) + 1;
/** La reprimenda chiude il ciclo e porta la penalità automatica in griglia? */
export const isReprimandGridPenalty = (cycleNumber: number | null): boolean => cycleNumber === REPRIMANDS_PER_GRID_PENALTY;

/** La violazione è il numero dell'articolo violato: solo cifre e punti, es. "2.5.5.3.1". */
export const PENALTY_VIOLATION_MAX_LENGTH = 20;
const ARTICLE_NUMBER_PATTERN = /^\d+(?:\.\d+)*$/;
/** Numero di articolo valido: cifre separate da punti singoli. */
export const isArticleNumber = (value: string): boolean => ARTICLE_NUMBER_PATTERN.test(value);
/** Durante la scrittura restano solo cifre e punti. */
export const sanitizeArticleInput = (rawValue: string): string => rawValue.replace(/[^\d.]/g, '');

/** Documento del regolamento a cui appartiene l'articolo violato. */
export const PENALTY_DOCUMENTS = ['code-of-conduct', 'technical-regulations'] as const;
export type PenaltyDocument = (typeof PENALTY_DOCUMENTS)[number];
export const isPenaltyDocument = (value: unknown): value is PenaltyDocument => PENALTY_DOCUMENTS.some((document) => document === value);
export const PENALTY_REASON_MAX_LENGTH = 2000;
/** L'inglese può essere un po' più lungo dell'originale. */
export const ENGLISH_REASON_MAX_LENGTH = 3000;
/** Al massimo tutte le vetture di un campionato. */
export const PENALTY_CREWS_MAX = 99;

/** Una vettura coinvolta e la decisione che la riguarda (null = nessuna). */
export interface PenaltyCrewDecision {
  readonly crewId: number;
  readonly decision: PenaltyDecision | null;
}

/** Motivazione in inglese, per il referto in inglese (la violazione è una frase fissa con numero e documento). */
export interface EnglishPenaltyText {
  readonly reason: string;
}

/** Traduzione inglese salvata: automatica (Workers AI) o scritta/corretta a mano. */
export interface SavedEnglishPenaltyText extends EnglishPenaltyText {
  readonly source: 'automatic' | 'manual';
  /** Corretta a mano ma poi è cambiato il testo originale: va ricontrollata. */
  readonly isOutdated: boolean;
}

export interface PenaltyDraft {
  /** Vetture coinvolte, almeno una, senza ripetizioni, in ordine di id. */
  readonly crews: readonly PenaltyCrewDecision[];
  /** Numero dell'articolo violato (cifre e punti); nelle penalità salvate prima può essere un testo libero. */
  readonly violation: string;
  readonly document: PenaltyDocument;
  /** Motivazione (facoltativa), testo libero su più righe. */
  readonly reason: string;
  /**
   * Solo nel salvataggio: traduzione inglese corretta a mano (oggetto), da rifare in automatico (null)
   * o lasciata come sta (assente).
   */
  readonly englishText?: EnglishPenaltyText | null;
}

/** Vettura di una penalità salvata: per le reprimende anche il numero nel ciclo (1–3), calcolato dal server. */
export interface SavedPenaltyCrew extends PenaltyCrewDecision {
  readonly reprimandNumber: number | null;
}

export interface SavedPenalty extends Omit<PenaltyDraft, 'englishText'> {
  readonly crews: readonly SavedPenaltyCrew[];
  /** null finché non c'è una traduzione (non ancora fatta o non riuscita). */
  readonly english: SavedEnglishPenaltyText | null;
  readonly id: number;
  readonly raceId: number;
  readonly updatedAt: string;
}

export interface PenaltyDraftIssues {
  readonly crews?: 'required' | 'invalid';
  readonly violation?: 'required' | 'too-long' | 'invalid';
  readonly document?: 'required' | 'invalid';
  readonly reason?: 'too-long' | 'invalid';
  readonly englishText?: 'invalid';
}

export type PenaltyDraftValidation =
  | { readonly isValid: true; readonly penalty: PenaltyDraft }
  | { readonly isValid: false; readonly issues: PenaltyDraftIssues };

/** Il numero dell'articolo senza spazi. */
export const normalizeViolation = (rawValue: string): string => rawValue.replace(/\s+/g, '');
/** La motivazione tiene gli a capo; si tolgono solo spazi e righe vuote all'inizio e alla fine. */
export const normalizeReason = (rawValue: string): string => rawValue.replace(/\r\n?/g, '\n').trim();


function readCrews(rawValue: unknown): PenaltyCrewDecision[] | null {
  if (!Array.isArray(rawValue) || rawValue.length > PENALTY_CREWS_MAX) return null;
  const crews: PenaltyCrewDecision[] = [];
  for (const rawCrew of rawValue) {
    if (typeof rawCrew !== 'object' || rawCrew === null) return null;
    const { crewId, decision = null } = rawCrew as Record<string, unknown>;
    if (!isPositiveInteger(crewId) || (decision !== null && !isPenaltyDecision(decision))) return null;
    crews.push({ crewId, decision });
  }
  if (new Set(crews.map((crew) => crew.crewId)).size !== crews.length) return null;
  return crews.sort((first, second) => first.crewId - second.crewId);
}

export function validatePenaltyDraft(input: unknown): PenaltyDraftValidation {
  const candidate = fieldsOf(input);
  const crews = readCrews(candidate.crews ?? []);
  const violation = typeof candidate.violation === 'string' ? normalizeViolation(candidate.violation) : '';
  const reason = typeof candidate.reason === 'string' ? normalizeReason(candidate.reason) : candidate.reason === undefined ? '' : null;

  const issues: { -readonly [Field in keyof PenaltyDraftIssues]: PenaltyDraftIssues[Field] } = {};
  if (!crews) issues.crews = 'invalid';
  else if (crews.length === 0) issues.crews = 'required';
  if (violation === '') issues.violation = 'required';
  else if (violation.length > PENALTY_VIOLATION_MAX_LENGTH) issues.violation = 'too-long';
  else if (!isArticleNumber(violation)) issues.violation = 'invalid';
  const document = isPenaltyDocument(candidate.document) ? candidate.document : null;
  if (document === null) issues.document = candidate.document === undefined || candidate.document === '' ? 'required' : 'invalid';
  if (reason === null) issues.reason = 'invalid';
  else if (reason.length > PENALTY_REASON_MAX_LENGTH) issues.reason = 'too-long';

  const englishText = readEnglishText(candidate.englishText);
  if (englishText === 'invalid') issues.englishText = 'invalid';

  if (!crews || reason === null || document === null || englishText === 'invalid' || Object.keys(issues).length > 0) {
    return { isValid: false, issues };
  }
  return { isValid: true, penalty: { crews, violation, document, reason, ...(englishText !== undefined && { englishText }) } };
}

/** Traduzione mandata dall'app: assente, null (rifare in automatico) o motivazione inglese non vuota. */
function readEnglishText(rawValue: unknown): EnglishPenaltyText | null | undefined | 'invalid' {
  if (rawValue === undefined || rawValue === null) return rawValue;
  if (typeof rawValue !== 'object') return 'invalid';
  const { reason } = rawValue as Record<string, unknown>;
  if (typeof reason !== 'string') return 'invalid';
  const englishReason = normalizeReason(reason);
  if (englishReason === '' || englishReason.length > ENGLISH_REASON_MAX_LENGTH) return 'invalid';
  return { reason: englishReason };
}
