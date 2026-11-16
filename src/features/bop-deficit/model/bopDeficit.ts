/** Secondi di penalità per ogni kg o PS di vantaggio, per ogni giro (cella N8 del foglio). */
export const PENALTY_SECONDS_PER_UNIT_PER_LAP = 0.5;

export interface BopDeficitInputs {
  readonly bopWeightKg: number;
  readonly actualWeightKg: number;
  readonly bopPowerPs: number;
  readonly actualPowerPs: number;
  readonly completedLaps: number;
}

export interface BopDeficit {
  /** Positivo quando l'auto è più leggera del BoP (cella N4). */
  readonly weightAdvantageKg: number;
  /** Positivo quando l'auto è più potente del BoP (cella N6). */
  readonly powerAdvantagePs: number;
  /** Penalità in secondi; negativa se l'auto è complessivamente svantaggiata (cella G7). */
  readonly totalPenaltySeconds: number;
}

/** Traduzione 1:1 del foglio "Calcolatore deficit BoP". */
export function computeBopDeficit(inputs: BopDeficitInputs): BopDeficit {
  const weightAdvantageKg = inputs.bopWeightKg - inputs.actualWeightKg;
  const powerAdvantagePs = inputs.actualPowerPs - inputs.bopPowerPs;
  const totalPenaltySeconds =
    (weightAdvantageKg + powerAdvantagePs) * inputs.completedLaps * PENALTY_SECONDS_PER_UNIT_PER_LAP;

  return { weightAdvantageKg, powerAdvantagePs, totalPenaltySeconds };
}
