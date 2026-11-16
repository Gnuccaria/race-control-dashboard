import { describe, expect, it } from 'vitest';
import { getDayPeriod } from './dayPeriod';

describe('getDayPeriod', () => {
  it.each([
    [4, 'night'],
    [5, 'morning'],
    [12, 'morning'],
    [13, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [22, 'evening'],
    [23, 'night'],
    [0, 'night'],
  ])('alle %i è "%s"', (hour, expectedDayPeriod) => {
    expect(getDayPeriod(hour)).toBe(expectedDayPeriod);
  });
});
