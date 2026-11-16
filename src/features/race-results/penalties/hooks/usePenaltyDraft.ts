import { type PenaltyDecision, type PenaltyDocument, sanitizeArticleInput } from '@shared/penaltyRules';
import { useState } from 'react';
import { checkPenaltyDraft, EMPTY_PENALTY_VALUES, type PenaltyDraftValues, validatePenaltyValues } from '../model/penaltyDraft';

/** Stato del form di una penalità (nuova o esistente); validità derivata durante il render. */
export function usePenaltyDraft(initialValues: PenaltyDraftValues = EMPTY_PENALTY_VALUES) {
  const [values, setValues] = useState<PenaltyDraftValues>(initialValues);

  return {
    values,
    check: checkPenaltyDraft(values),
    /** Spunta o toglie una vettura coinvolta (togliendola si perde anche la sua decisione). */
    toggleCrew: (crewId: number) => {
      setValues((previousValues) => ({
        ...previousValues,
        crews: previousValues.crews.some((crew) => crew.crewId === crewId)
          ? previousValues.crews.filter((crew) => crew.crewId !== crewId)
          : [...previousValues.crews, { crewId, decision: null }],
      }));
    },
    /** Decisione per una vettura coinvolta; null = nessuna. */
    changeCrewDecision: (crewId: number, decision: PenaltyDecision | null) => {
      setValues((previousValues) => ({
        ...previousValues,
        crews: previousValues.crews.map((crew) => (crew.crewId === crewId ? { ...crew, decision } : crew)),
      }));
    },
    /** Restano solo cifre e punti. */
    changeViolation: (violation: string) => {
      setValues((previousValues) => ({ ...previousValues, violation: sanitizeArticleInput(violation) }));
    },
    changeDocument: (document: PenaltyDocument) => {
      setValues((previousValues) => ({ ...previousValues, document }));
    },
    changeReason: (reason: string) => {
      setValues((previousValues) => ({ ...previousValues, reason }));
    },
    validate: () => validatePenaltyValues(values),
  };
}

export type PenaltyDraftState = ReturnType<typeof usePenaltyDraft>;
