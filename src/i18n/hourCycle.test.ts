import { describe, expect, it } from 'vitest';
import { dayPeriodLabels, usesTwelveHourClock } from './hourCycle';

describe('orologio della lingua', () => {
  it('usa le 24 ore in italiano, francese e tedesco e le 12 ore in inglese', () => {
    expect(usesTwelveHourClock('it')).toBe(false);
    expect(usesTwelveHourClock('fr')).toBe(false);
    expect(usesTwelveHourClock('de')).toBe(false);
    expect(usesTwelveHourClock('en')).toBe(true);
    expect(dayPeriodLabels('en')).toEqual({ am: 'AM', pm: 'PM' });
  });
});
