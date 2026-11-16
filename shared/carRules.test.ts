import { describe, expect, it } from 'vitest';
import { formatCarName, toCarKey, validateCarDraft } from './carRules';

describe('regole auto', () => {
  it('normalizza i nomi e lascia vuoti i dati non indicati', () => {
    expect(validateCarDraft({ manufacturer: '  Mercedes-AMG ', model: 'GT3   Evo' })).toEqual({
      isValid: true,
      car: { manufacturer: 'Mercedes-AMG', model: 'GT3 Evo', horsepower: null, weightKg: null, limiter: null, ballastKg: null },
    });
    expect(validateCarDraft({ manufacturer: 'Audi', model: '' })).toMatchObject({ isValid: true, car: { model: null } });
  });

  it('controlla nomi e numeri', () => {
    expect(validateCarDraft({ manufacturer: '', model: '<b>', horsepower: 0, weightKg: 12.5, limiter: -1, ballastKg: Number.NaN })).toEqual({
      isValid: false,
      issues: { manufacturer: 'required', model: 'invalid-characters', horsepower: 'invalid', weightKg: 'invalid', limiter: 'invalid', ballastKg: 'invalid' },
    });
    expect(validateCarDraft({ manufacturer: 'Audi', limiter: 97.5, ballastKg: 0 }).isValid).toBe(true);
  });

  it('riconosce la stessa auto senza badare alle maiuscole', () => {
    expect(toCarKey({ manufacturer: 'Porsche', model: '911 GT3 R' })).toBe(toCarKey({ manufacturer: 'PORSCHE', model: '911 gt3 r' }));
    expect(formatCarName({ manufacturer: 'Porsche', model: null })).toBe('Porsche');
  });
});
