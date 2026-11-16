import { describe, expect, it } from 'vitest';
import { checkPenaltyDraft, EMPTY_PENALTY_VALUES } from './penaltyDraft';

const values = (overrides: Partial<typeof EMPTY_PENALTY_VALUES>) => ({
  ...EMPTY_PENALTY_VALUES,
  crews: [{ crewId: 1, decision: null }],
  document: 'code-of-conduct' as const,
  violation: '2.4',
  ...overrides,
});

describe('form della penalità', () => {
  it('è completo con vetture, numero di articolo valido e documento', () => {
    expect(checkPenaltyDraft(values({})).isComplete).toBe(true);
    expect(checkPenaltyDraft(values({ document: '' })).isComplete).toBe(false);
    expect(checkPenaltyDraft(values({ violation: '' })).isComplete).toBe(false);
  });

  it('segnala un numero di articolo non valido, ma non il punto finale mentre si scrive', () => {
    expect(checkPenaltyDraft(values({ violation: '2.' }))).toMatchObject({ isViolationInvalid: false, isComplete: false });
    expect(checkPenaltyDraft(values({ violation: '2..4' }))).toMatchObject({ isViolationInvalid: true, isComplete: false });
    expect(checkPenaltyDraft(values({ violation: 'Contatto in curva 1' }))).toMatchObject({ isViolationInvalid: true });
  });
});
