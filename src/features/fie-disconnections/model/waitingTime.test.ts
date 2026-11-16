import { describe, expect, it } from 'vitest';
import { computeWaitingTime, type TrackSettings } from './waitingTime';

const SPREADSHEET_TRACK: TrackSettings = {
  driveThroughSeconds: 22,
  stintTotalLaps: 29,
  trackLengthKm: 5.807,
  pitStallEntrySeconds: 9,
};

/** Valori attesi ottenuti ricalcolando il foglio originale con gli stessi input. */
describe('computeWaitingTime riproduce il foglio Excel', () => {
  it('P2–P14, esempio del foglio: 3 min 53 s', () => {
    const waitingTime = computeWaitingTime({ position: 'chasing', disconnectedOnLap: 1, gapSeconds: 43 }, SPREADSHEET_TRACK);

    expect(waitingTime.missingLaps).toBe(29);
    expect(waitingTime.penaltySeconds).toBeCloseTo(190.403, 9);
    expect([waitingTime.minutes, waitingTime.seconds]).toEqual([3, 53]);
  });

  it('P1, esempio del foglio: 3 min 25 s', () => {
    const waitingTime = computeWaitingTime({ position: 'leader', disconnectedOnLap: 0, gapSeconds: 0 }, SPREADSHEET_TRACK);

    expect(waitingTime.missingLaps).toBe(30);
    expect(waitingTime.penaltySeconds).toBeCloseTo(196.21, 9);
    expect([waitingTime.minutes, waitingTime.seconds]).toEqual([3, 25]);
  });

  it('P1 con distacco superiore alla penalità: attesa negativa come nel foglio (−5 min 36 s)', () => {
    const waitingTime = computeWaitingTime({ position: 'leader', disconnectedOnLap: 29, gapSeconds: 300 }, SPREADSHEET_TRACK);

    expect(waitingTime.totalWaitSeconds).toBeLessThan(0);
    expect([waitingTime.minutes, waitingTime.seconds]).toEqual([-5, 36]);
  });
});
