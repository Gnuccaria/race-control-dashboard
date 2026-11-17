import { describe, expect, it } from 'vitest';
import { formatCarName, toCarKey, validateCarDraft } from './carRules';

describe('regole auto', () => {
  it('normalizza i nomi e lascia vuoti i dati non indicati', () => {
    expect(validateCarDraft({ manufacturer: '  Mercedes-AMG ', model: 'GT3   Evo', championships: ['All Japan GT Championship', 'Cool1 FIE Championship'] })).toEqual({
      isValid: true,
      car: {
        manufacturer: 'Mercedes-AMG',
        model: 'GT3 Evo',
        horsepower: null,
        weightKg: null,
        limiter: null,
        ballastKg: null,
        championships: ['Cool1 FIE Championship', 'All Japan GT Championship'],
      },
    });
    expect(validateCarDraft({ manufacturer: 'Audi', model: '', championships: ['Cool1 FIE Championship'] })).toMatchObject({ isValid: true, car: { model: null } });
  });

  it('controlla nomi e numeri', () => {
    expect(validateCarDraft({ manufacturer: '', model: '<b>', horsepower: 0, weightKg: 12.5, limiter: -1, ballastKg: Number.NaN })).toEqual({
      isValid: false,
      issues: { manufacturer: 'required', model: 'invalid-characters', horsepower: 'invalid', weightKg: 'invalid', limiter: 'invalid', ballastKg: 'invalid', championships: 'required' },
    });
    expect(validateCarDraft({ manufacturer: 'Audi', limiter: 97.5, ballastKg: 0, championships: ['Cool1 FIE Championship'] }).isValid).toBe(true);
    // Almeno un campionato, tra quelli previsti.
    expect(validateCarDraft({ manufacturer: 'Audi', championships: ['Serie X'] })).toEqual({ isValid: false, issues: { championships: 'invalid' } });
  });

  it('riconosce la stessa auto senza badare alle maiuscole', () => {
    expect(toCarKey({ manufacturer: 'Porsche', model: '911 GT3 R' })).toBe(toCarKey({ manufacturer: 'PORSCHE', model: '911 gt3 r' }));
    expect(formatCarName({ manufacturer: 'Porsche', model: null })).toBe('Porsche');
  });
});
