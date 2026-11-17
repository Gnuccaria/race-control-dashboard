import { describe, expect, it } from 'vitest';
import { computeBallastKg, computeLimiterPercent, formatCarName, readCarSourceMatches, toCarKey, validateCarDraft } from './carRules';

describe('regole auto', () => {
  it('normalizza i nomi, lascia vuoti i dati non indicati e calcola limitatore e zavorra', () => {
    expect(validateCarDraft({ manufacturer: '  Mercedes-AMG ', model: "GT3   '20" })).toEqual({
      isValid: true,
      car: {
        manufacturer: 'Mercedes-AMG',
        model: "GT3 '20",
        group: null,
        drivetrain: null,
        horsepower: null,
        weightKg: null,
        bopHorsepower: null,
        bopWeightKg: null,
        limiter: null,
        ballastKg: null,
      },
    });
    expect(
      validateCarDraft({ manufacturer: 'Alfa Romeo', model: '4C Gr.3', group: 'Gr.3', drivetrain: 'MR', horsepower: 536, weightKg: 1220, bopHorsepower: 461, bopWeightKg: 1230, limiter: 5 }),
    ).toMatchObject({ isValid: true, car: { group: 'Gr.3', drivetrain: 'MR', limiter: 86, ballastKg: 10 } });
  });

  it('controlla nomi, gruppo, trasmissione e numeri', () => {
    expect(validateCarDraft({ manufacturer: '', model: '<b>', group: 'Gr.N', drivetrain: 'XX', horsepower: 0, weightKg: 12.5, bopHorsepower: -1, bopWeightKg: Number.NaN })).toEqual({
      isValid: false,
      issues: {
        manufacturer: 'required',
        model: 'invalid-characters',
        group: 'invalid',
        drivetrain: 'invalid',
        horsepower: 'invalid',
        weightKg: 'invalid',
        bopHorsepower: 'invalid',
        bopWeightKg: 'invalid',
      },
    });
  });

  it('% limitatore e zavorra arrotondati all\'unità; la zavorra è negativa se il BoP toglie peso', () => {
    expect(computeLimiterPercent(536, 461)).toBe(86);
    expect(computeLimiterPercent(500, 512)).toBe(102);
    expect(computeLimiterPercent(null, 461)).toBeNull();
    expect(computeBallastKg(1220, 1230)).toBe(10);
    expect(computeBallastKg(1300, 1250)).toBe(-50);
    expect(computeBallastKg(1220, null)).toBeNull();
  });

  it('legge gli abbinamenti scelti a mano', () => {
    expect(readCarSourceMatches(undefined)).toEqual([]);
    expect(readCarSourceMatches([{ officialId: 'car102', bopKey: "Gr.3|BMW|M3 GT3 '11" }, { officialId: 'car7', bopKey: null }])).toHaveLength(2);
    expect(readCarSourceMatches([{ officialId: 'x', bopKey: null }])).toBeNull();
    expect(readCarSourceMatches([{ officialId: 'car1', bopKey: null }, { officialId: 'car1', bopKey: null }])).toBeNull();
  });

  it('riconosce la stessa auto senza badare alle maiuscole', () => {
    expect(toCarKey({ manufacturer: 'Porsche', model: '911 GT3 R' })).toBe(toCarKey({ manufacturer: 'PORSCHE', model: '911 gt3 r' }));
    expect(formatCarName({ manufacturer: 'Porsche', model: null })).toBe('Porsche');
  });
});
