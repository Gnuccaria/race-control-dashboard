import { describe, expect, it } from 'vitest';
import { computeBopDeficit } from './bopDeficit';

/** Valori attesi ottenuti ricalcolando il foglio originale con gli stessi input. */
describe('computeBopDeficit riproduce il foglio Excel', () => {
  it('nessuna penalità con valori identici al BoP', () => {
    expect(
      computeBopDeficit({ bopWeightKg: 1300, actualWeightKg: 1300, bopPowerPs: 500, actualPowerPs: 500, completedLaps: 10 }),
    ).toEqual({ weightAdvantageKg: 0, powerAdvantagePs: 0, totalPenaltySeconds: 0 });
  });

  it('auto più leggera e più potente: (10 kg + 5 PS) × 12 giri × 0,5 s', () => {
    expect(
      computeBopDeficit({ bopWeightKg: 1300, actualWeightKg: 1290, bopPowerPs: 500, actualPowerPs: 505, completedLaps: 12 }),
    ).toEqual({ weightAdvantageKg: 10, powerAdvantagePs: 5, totalPenaltySeconds: 90 });
  });

  it('auto svantaggiata: risultato negativo come nel foglio', () => {
    expect(
      computeBopDeficit({ bopWeightKg: 1250, actualWeightKg: 1270, bopPowerPs: 480, actualPowerPs: 470, completedLaps: 7 })
        .totalPenaltySeconds,
    ).toBe(-105);
  });
});
