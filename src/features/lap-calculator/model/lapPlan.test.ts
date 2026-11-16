import { describe, expect, it } from 'vitest';
import { formatClock } from './clock';
import { computeLapPlan, type LapPlanInputs } from './lapPlan';
import { formatDuration, getScheduleStatus } from './presentation';
import { RACE_FORMATS } from './raceFormats';

interface SpreadsheetScenario {
  readonly name: string;
  readonly raceFormatId: (typeof RACE_FORMATS)[number]['id'];
  readonly averageLapSeconds: number;
  readonly currentTime: [hours: number, minutes: number];
  readonly plannedStintEnd: [hours: number, minutes: number];
  readonly lobbyCounter: [completedLaps: number, totalLaps: number];
  readonly currentLobby: number;
  /** Valori mostrati dal foglio originale ricalcolato con gli stessi input. */
  readonly expected: {
    readonly validLaps: string;
    readonly estimatedEnd: string;
    readonly deviation: string;
    readonly status: string;
    readonly lapsToSet: number | null;
    readonly nextPlannedEnd: string | null;
    readonly reference: [validLapsPerStint: number, totalLapsPerLobby: number, totalLapsFinalLobby: number];
  };
}

const SPREADSHEET_SCENARIOS: SpreadsheetScenario[] = [
  {
    name: 'esempio del foglio: penultima lobby in ritardo',
    raceFormatId: '6h',
    averageLapSeconds: 120,
    currentTime: [21, 5],
    plannedStintEnd: [21, 0],
    lobbyCounter: [29, 30],
    currentLobby: 5,
    expected: {
      validLaps: '28 / 28',
      estimatedEnd: '21:05:00',
      deviation: '5 min 0 s',
      status: 'late',
      lapsToSet: 29,
      nextPlannedEnd: '22:00:00',
      reference: [30, 32, 31],
    },
  },
  {
    name: 'passaggio della mezzanotte',
    raceFormatId: '6h',
    averageLapSeconds: 120,
    currentTime: [23, 50],
    plannedStintEnd: [0, 10],
    lobbyCounter: [3, 32],
    currentLobby: 1,
    expected: {
      validLaps: '2 / 30',
      estimatedEnd: '00:46:00',
      deviation: '36 min 0 s',
      status: 'late',
      lapsToSet: 14,
      nextPlannedEnd: '01:10:00',
      reference: [30, 32, 31],
    },
  },
  {
    name: 'ultima lobby con giro medio decimale',
    raceFormatId: '3h',
    averageLapSeconds: 118.7,
    currentTime: [14, 0],
    plannedStintEnd: [14, 30],
    lobbyCounter: [5, 48],
    currentLobby: 2,
    expected: {
      validLaps: '4 / 47',
      estimatedEnd: '15:25:04',
      deviation: '55 min 4 s',
      status: 'late',
      lapsToSet: null,
      nextPlannedEnd: null,
      reference: [46, 48, 47],
    },
  },
  {
    name: 'in orario',
    raceFormatId: '12h',
    averageLapSeconds: 130,
    currentTime: [9, 0],
    plannedStintEnd: [9, 0],
    lobbyCounter: [56, 57],
    currentLobby: 4,
    expected: {
      validLaps: '55 / 55',
      estimatedEnd: '09:00:00',
      deviation: '0 s',
      status: 'on-time',
      lapsToSet: 58,
      nextPlannedEnd: '11:00:00',
      reference: [56, 58, 57],
    },
  },
  {
    name: 'in anticipo',
    raceFormatId: '6h',
    averageLapSeconds: 120,
    currentTime: [20, 50],
    plannedStintEnd: [21, 0],
    lobbyCounter: [28, 32],
    currentLobby: 2,
    expected: {
      validLaps: '27 / 30',
      estimatedEnd: '20:56:00',
      deviation: '4 min 0 s',
      status: 'early',
      lapsToSet: 34,
      nextPlannedEnd: '22:00:00',
      reference: [30, 32, 31],
    },
  },
];

function toLapPlanInputs(scenario: SpreadsheetScenario): LapPlanInputs {
  const raceFormat = RACE_FORMATS.find(({ id }) => id === scenario.raceFormatId);
  if (!raceFormat) throw new Error(`Formato gara sconosciuto: ${scenario.raceFormatId}`);
  const [currentHours, currentMinutes] = scenario.currentTime;
  const [plannedHours, plannedMinutes] = scenario.plannedStintEnd;
  const [completedLaps, totalLaps] = scenario.lobbyCounter;

  return {
    raceFormat,
    averageLapSeconds: scenario.averageLapSeconds,
    currentTime: { hours: currentHours, minutes: currentMinutes },
    plannedStintEnd: { hours: plannedHours, minutes: plannedMinutes },
    completedLaps,
    totalLaps,
    currentLobby: scenario.currentLobby,
  };
}

describe('computeLapPlan riproduce il foglio Excel', () => {
  it.each(SPREADSHEET_SCENARIOS)('$name', (scenario) => {
    const lapPlan = computeLapPlan(toLapPlanInputs(scenario));
    const { currentLobby, nextLobby, isFinalLobby, uncorrectedReference } = lapPlan;

    expect(`${currentLobby.completedValidLaps} / ${currentLobby.totalValidLaps}`).toBe(scenario.expected.validLaps);
    expect(formatClock(currentLobby.estimatedEndSeconds)).toBe(scenario.expected.estimatedEnd);
    expect(formatDuration(currentLobby.deviationSeconds)).toBe(scenario.expected.deviation);
    expect(getScheduleStatus(currentLobby.deviationSeconds)).toBe(scenario.expected.status);
    expect(isFinalLobby ? null : nextLobby.lapsToSet).toBe(scenario.expected.lapsToSet);
    expect(isFinalLobby ? null : formatClock(nextLobby.plannedEndSeconds)).toBe(scenario.expected.nextPlannedEnd);
    expect([
      uncorrectedReference.validLapsPerStint,
      uncorrectedReference.totalLapsPerLobby,
      uncorrectedReference.totalLapsFinalLobby,
    ]).toEqual(scenario.expected.reference);
  });
});
