import { describe, expect, it } from 'vitest';
import { formatClock } from './clock';
import { formatDuration, getScheduleStatus } from './presentation';
import { getStintCount, RACE_FORMATS } from './raceFormats';

describe('formattazione del calcolatore di giri', () => {
  it('formatta gli orari in hh:mm:ss', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(75_845.4)).toBe('21:04:05');
    expect(formatClock(86_399.6)).toBe('00:00:00');
  });

  it('formatta le durate come il foglio', () => {
    expect(formatDuration(42)).toBe('42 s');
    expect(formatDuration(-125)).toBe('2 min 5 s');
  });

  it('classifica lo stato dello stint', () => {
    expect(getScheduleStatus(-0.4)).toBe('on-time');
    expect(getScheduleStatus(1)).toBe('late');
    expect(getScheduleStatus(-1)).toBe('early');
  });

  it('ricava il numero di stint di ogni formato', () => {
    expect(RACE_FORMATS.map(getStintCount)).toEqual([2, 6, 6, 6]);
  });
});
