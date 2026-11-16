import { formatClock } from './clock';
import { excelRound } from '@/lib/excel';
import type { LapPlan } from './lapPlan';

export type ScheduleStatus = 'on-time' | 'early' | 'late';

/** C24: in orario se lo scarto arrotondato al secondo è zero. */
export function getScheduleStatus(deviationSeconds: number): ScheduleStatus {
  if (excelRound(deviationSeconds) === 0) return 'on-time';
  return deviationSeconds > 0 ? 'late' : 'early';
}

/** Durata senza segno nel formato del foglio: "5 min 0 s", "42 s". */
export function formatDuration(seconds: number): string {
  const roundedSeconds = excelRound(Math.abs(seconds));
  const minutesPart = roundedSeconds >= 60 ? `${Math.floor(roundedSeconds / 60)} min ` : '';
  return `${minutesPart}${roundedSeconds % 60} s`;
}

export type NextLobbyView =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'upcoming';
      readonly lapsToSet: number;
      readonly validLaps: number;
      readonly isFinalLobby: boolean;
      readonly plannedEnd: string;
    };

export interface ResultView {
  readonly scheduleStatus: ScheduleStatus;
  /** Scarto senza segno, null quando la lobby è in orario. */
  readonly deviation: string | null;
  readonly plannedEnd: string;
  readonly estimatedEnd: string;
  readonly completedValidLaps: number;
  readonly totalValidLaps: number;
  readonly nextLobby: NextLobbyView;
  readonly uncorrectedReference: LapPlan['uncorrectedReference'];
}

/** Trasforma il piano numerico nei valori pronti da mostrare. */
export function buildResultView(plan: LapPlan): ResultView {
  const { currentLobby, nextLobby, isFinalLobby, isNextFinalLobby, uncorrectedReference } = plan;
  const scheduleStatus = getScheduleStatus(currentLobby.deviationSeconds);

  return {
    scheduleStatus,
    deviation: scheduleStatus === 'on-time' ? null : formatDuration(currentLobby.deviationSeconds),
    plannedEnd: formatClock(currentLobby.plannedEndSeconds),
    estimatedEnd: formatClock(currentLobby.estimatedEndSeconds),
    completedValidLaps: currentLobby.completedValidLaps,
    totalValidLaps: currentLobby.totalValidLaps,
    nextLobby: isFinalLobby
      ? { kind: 'none' }
      : {
          kind: 'upcoming',
          lapsToSet: nextLobby.lapsToSet,
          validLaps: nextLobby.validLaps,
          isFinalLobby: isNextFinalLobby,
          plannedEnd: formatClock(nextLobby.plannedEndSeconds),
        },
    uncorrectedReference,
  };
}
