import { describe, expect, it } from 'vitest';
import { reviveStoredForm } from './reviveStoredForm';

const DEFAULT_FORM = { mode: 'a', amount: '10' };

describe('reviveStoredForm', () => {
  it('scarta dati salvati che non sono oggetti', () => {
    expect(reviveStoredForm(null, DEFAULT_FORM)).toBeNull();
    expect(reviveStoredForm('testo', DEFAULT_FORM)).toBeNull();
  });

  it('completa i campi mancanti e ignora quelli sconosciuti o non testuali', () => {
    expect(reviveStoredForm({ amount: '42', extra: 'x', mode: 3 }, DEFAULT_FORM)).toEqual({ mode: 'a', amount: '42' });
  });

  it('applica la convalida aggiuntiva dei valori', () => {
    const isAllowedValue = (fieldName: string, value: string) => fieldName !== 'mode' || value === 'a' || value === 'b';
    expect(reviveStoredForm({ mode: 'z' }, DEFAULT_FORM, isAllowedValue)?.mode).toBe('a');
    expect(reviveStoredForm({ mode: 'b' }, DEFAULT_FORM, isAllowedValue)?.mode).toBe('b');
  });
});
