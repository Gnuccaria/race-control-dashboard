import {
  isArticleNumber,
  normalizeViolation,
  PENALTY_REASON_MAX_LENGTH,
  PENALTY_VIOLATION_MAX_LENGTH,
  type PenaltyCrewDecision,
  type PenaltyDocument,
  type PenaltyDraftValidation,
  type SavedPenalty,
  validatePenaltyDraft,
} from '@shared/penaltyRules';

/** Valori del form di una penalità così come sono a schermo. */
export interface PenaltyDraftValues {
  /** Vetture coinvolte (nell'ordine in cui sono state spuntate), ognuna con la sua decisione facoltativa. */
  readonly crews: readonly PenaltyCrewDecision[];
  /** Numero dell'articolo violato (cifre e punti). */
  readonly violation: string;
  /** '' finché non si sceglie. */
  readonly document: PenaltyDocument | '';
  readonly reason: string;
}

export const EMPTY_PENALTY_VALUES: PenaltyDraftValues = { crews: [], violation: '', document: '', reason: '' };

export const toPenaltyDraftValues = (penalty: SavedPenalty): PenaltyDraftValues => ({
  crews: penalty.crews,
  violation: penalty.violation,
  document: penalty.document,
  reason: penalty.reason,
});

export interface PenaltyDraftCheck {
  readonly isViolationTooLong: boolean;
  /** Scritto ma non è un numero di articolo (un punto finale mentre si scrive non conta). */
  readonly isViolationInvalid: boolean;
  readonly isReasonTooLong: boolean;
  /** Almeno una vettura, articolo valido e documento, nessun testo troppo lungo (le decisioni sono facoltative). */
  readonly isComplete: boolean;
}

export function checkPenaltyDraft(values: PenaltyDraftValues): PenaltyDraftCheck {
  const violation = normalizeViolation(values.violation);
  const isViolationTooLong = violation.length > PENALTY_VIOLATION_MAX_LENGTH;
  const isBeingTyped = /^\d+(?:\.\d+)*\.$/.test(violation);
  const isViolationInvalid = violation !== '' && !isViolationTooLong && !isArticleNumber(violation) && !isBeingTyped;
  const isReasonTooLong = values.reason.trim().length > PENALTY_REASON_MAX_LENGTH;
  return {
    isViolationTooLong,
    isViolationInvalid,
    isReasonTooLong,
    isComplete: values.crews.length > 0 && isArticleNumber(violation) && !isViolationTooLong && values.document !== '' && !isReasonTooLong,
  };
}

/** Stessa convalida del server. */
export const validatePenaltyValues = (values: PenaltyDraftValues): PenaltyDraftValidation => validatePenaltyDraft(values);
