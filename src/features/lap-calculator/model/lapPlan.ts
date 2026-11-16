import { type ClockTime, clockToSeconds } from './clock';
import { excelMod, excelRound, excelRoundUp, HALF_DAY_SECONDS, SECONDS_PER_DAY, wrapToDay } from '@/lib/excel';
import { getStintCount, type RaceFormat } from './raceFormats';

export interface LapPlanInputs {
  readonly raceFormat: RaceFormat;
  /** Giro medio in secondi (> 0). */
  readonly averageLapSeconds: number;
  readonly currentTime: ClockTime;
  /** Fine prevista dello stint corrente: ultimo giro valido, giro finale escluso. */
  readonly plannedStintEnd: ClockTime;
  /** Giri completati come da contatore della lobby. */
  readonly completedLaps: number;
  /** Giri totali come da contatore della lobby. */
  readonly totalLaps: number;
  readonly currentLobby: number;
}

export interface LapPlan {
  readonly isFinalLobby: boolean;
  readonly isNextFinalLobby: boolean;
  readonly currentLobby: {
    readonly completedValidLaps: number;
    readonly totalValidLaps: number;
    readonly remainingValidLaps: number;
    readonly plannedEndSeconds: number;
    readonly estimatedEndSeconds: number;
    /** Positivo = ritardo, negativo = anticipo. */
    readonly deviationSeconds: number;
  };
  readonly nextLobby: {
    readonly validLaps: number;
    readonly nonRacingLaps: number;
    readonly lapsToSet: number;
    readonly plannedEndSeconds: number;
  };
  readonly uncorrectedReference: {
    readonly validLapsPerStint: number;
    readonly totalLapsPerLobby: number;
    readonly totalLapsFinalLobby: number;
  };
}

/** Giri non di gara: formazione + finale, oppure solo formazione nell'ultima lobby. */
const countNonRacingLaps = (isFinalLobby: boolean): number => (isFinalLobby ? 1 : 2);

/** Scarto in secondi riportato nell'intervallo ±12 ore (gestisce il passaggio della mezzanotte). */
const signedDifferenceWithinDay = (fromSeconds: number, toSeconds: number): number =>
  excelMod(fromSeconds - toSeconds + HALF_DAY_SECONDS, SECONDS_PER_DAY) - HALF_DAY_SECONDS;

/**
 * Traduzione 1:1 dei "CALCOLI DI SERVIZIO" del foglio originale (righe 37-57).
 * I commenti indicano la cella Excel corrispondente.
 */
export function computeLapPlan(inputs: LapPlanInputs): LapPlan {
  const { raceFormat, averageLapSeconds, currentLobby } = inputs;

  const stintCount = getStintCount(raceFormat); // C38
  const stintSeconds = raceFormat.stintMinutes * 60; // C39
  const isFinalLobby = currentLobby >= stintCount; // C41
  const isNextFinalLobby = currentLobby + 1 === stintCount; // C42

  const totalValidLaps = Math.max(0, inputs.totalLaps - countNonRacingLaps(isFinalLobby)); // C45
  const completedValidLaps = Math.max(0, Math.min(inputs.completedLaps - 1, totalValidLaps)); // C44
  const remainingValidLaps = Math.max(0, totalValidLaps - completedValidLaps); // C43

  const currentTimeSeconds = clockToSeconds(inputs.currentTime); // C46
  const plannedEndSeconds = clockToSeconds(inputs.plannedStintEnd); // C47
  const estimatedEndSeconds = wrapToDay(currentTimeSeconds + remainingValidLaps * averageLapSeconds); // C48
  const deviationSeconds = signedDifferenceWithinDay(estimatedEndSeconds, plannedEndSeconds); // C49

  const nextPlannedEndSeconds = wrapToDay(plannedEndSeconds + stintSeconds); // C54
  const secondsUntilNextPlannedEnd = wrapToDay(nextPlannedEndSeconds - estimatedEndSeconds); // C50
  const nextValidLaps = Math.max(1, excelRoundUp(excelRound(secondsUntilNextPlannedEnd, 3) / averageLapSeconds)); // C51
  const nextNonRacingLaps = countNonRacingLaps(isNextFinalLobby); // C52

  const validLapsPerStint = Math.max(1, excelRoundUp(stintSeconds / averageLapSeconds)); // C55

  return {
    isFinalLobby,
    isNextFinalLobby,
    currentLobby: {
      completedValidLaps,
      totalValidLaps,
      remainingValidLaps,
      plannedEndSeconds,
      estimatedEndSeconds,
      deviationSeconds,
    },
    nextLobby: {
      validLaps: nextValidLaps,
      nonRacingLaps: nextNonRacingLaps,
      lapsToSet: nextValidLaps + nextNonRacingLaps, // C53
      plannedEndSeconds: nextPlannedEndSeconds,
    },
    uncorrectedReference: {
      validLapsPerStint,
      totalLapsPerLobby: validLapsPerStint + 2, // C56
      totalLapsFinalLobby: validLapsPerStint + 1, // C57
    },
  };
}
