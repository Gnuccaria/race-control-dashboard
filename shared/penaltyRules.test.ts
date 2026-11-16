import { describe, expect, it } from 'vitest';
import { isArticleNumber, PENALTY_DECISIONS, penaltyGridPositions, penaltySeconds, sanitizeArticleInput, validatePenaltyDraft } from './penaltyRules';

describe('penalità', () => {
  it('convalida e normalizza una penalità con una decisione (facoltativa) per vettura', () => {
    expect(
      validatePenaltyDraft({
        crews: [
          { crewId: 7, decision: 'time-5' },
          { crewId: 2, decision: null },
        ],
        violation: ' 2.5. 5 ',
        document: 'technical-regulations',
        reason: '\n Spinta al via.\nNessun vantaggio restituito. \n',
      }),
    ).toEqual({
      isValid: true,
      penalty: {
        crews: [
          { crewId: 2, decision: null },
          { crewId: 7, decision: 'time-5' },
        ],
        violation: '2.5.5',
        document: 'technical-regulations',
        reason: 'Spinta al via.\nNessun vantaggio restituito.',
      },
    });
    // Nessuna decisione per nessuna vettura: ammesso (nel referto diventa "Nessuna azione ulteriore").
    expect(validatePenaltyDraft({ crews: [{ crewId: 1 }], violation: '2.4', document: 'code-of-conduct' })).toMatchObject({
      isValid: true,
      penalty: { crews: [{ crewId: 1, decision: null }], reason: '' },
    });
  });

  it('elenca i problemi', () => {
    expect(validatePenaltyDraft({})).toEqual({ isValid: false, issues: { crews: 'required', violation: 'required', document: 'required' } });
    expect(
      validatePenaltyDraft({ crews: [{ crewId: 1 }, { crewId: 1 }], violation: '1'.repeat(21), document: 'x', reason: 4 }),
    ).toEqual({ isValid: false, issues: { crews: 'invalid', violation: 'too-long', document: 'invalid', reason: 'invalid' } });
    expect(validatePenaltyDraft({ crews: [{ crewId: 1 }], violation: 'Track limits', document: 'code-of-conduct' })).toEqual({ isValid: false, issues: { violation: 'invalid' } });
    // "Nessuna azione ulteriore" non è più una decisione.
    expect(validatePenaltyDraft({ crews: [{ crewId: 1, decision: 'no-further-action' }], violation: '1', document: 'code-of-conduct' })).toEqual({ isValid: false, issues: { crews: 'invalid' } });
  });

  it('accetta come violazione solo numeri di articolo', () => {
    expect(['2', '2.4', '2.5.5.3.1'].every(isArticleNumber)).toBe(true);
    expect(['', '.2', '2.', '2..4', '2,4', 'art. 2'].some(isArticleNumber)).toBe(false);
    expect(sanitizeArticleInput('art. 2,5.1 C.d.C.')).toBe('.25.1...');
  });

  it('conosce secondi e posizioni in griglia delle decisioni', () => {
    expect(PENALTY_DECISIONS).toContain('grid-7');
    expect(penaltySeconds('time-30')).toBe(30);
    expect(penaltySeconds('reprimand')).toBeNull();
    expect(penaltyGridPositions('grid-3')).toBe(3);
    expect(penaltyGridPositions('time-5')).toBeNull();
  });
});
