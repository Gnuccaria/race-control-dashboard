import { describe, expect, it } from 'vitest';
import { addMinutesToClock, driverSwapCountFor, findChampionship, findDurationIssue, stintCount, stintStartTimes, validateChampionshipDraft } from './championshipRules';
import { DEFAULT_SESSION_SETTINGS } from './sessionSettingsRules';
import { TEST_CHAMPIONSHIPS } from './testChampionships';

const COMPLETE = {
  name: '  GT3   Sprint Cup ',
  durations: [
    { hours: 6, stintMinutes: 60, startTime: '18:00' },
    { hours: 3, stintMinutes: 90, startTime: '21:00' },
  ],
  carIds: [3, 1],
  sessionSettings: DEFAULT_SESSION_SETTINGS,
};

describe('regole campionato', () => {
  it('convalida nome, durate (ore e stint) e vetture; durate in ordine crescente', () => {
    expect(validateChampionshipDraft(COMPLETE)).toEqual({
      isValid: true,
      championship: {
        name: 'GT3 Sprint Cup',
        durations: [
          { hours: 3, stintMinutes: 90, startTime: '21:00' },
          { hours: 6, stintMinutes: 60, startTime: '18:00' },
        ],
        carIds: [3, 1],
        sessionSettings: DEFAULT_SESSION_SETTINGS,
      },
    });
    expect(validateChampionshipDraft({})).toEqual({
      isValid: false,
      issues: { name: 'required', durations: 'invalid', carIds: 'invalid', sessionSettings: { session: 'race', key: 'startType' } },
    });
    expect(validateChampionshipDraft({ ...COMPLETE, durations: [{ hours: 6, stintMinutes: 60 }] })).toMatchObject({ issues: { durations: 'start-time' } });
    expect(validateChampionshipDraft({ ...COMPLETE, durations: [{ hours: 6, stintMinutes: 60, startTime: '9:00' }] })).toMatchObject({
      issues: { durations: 'start-time' },
    });
    expect(validateChampionshipDraft({ ...COMPLETE, name: '<b>' })).toMatchObject({ issues: { name: 'invalid-characters' } });
    expect(validateChampionshipDraft({ ...COMPLETE, name: 'x'.repeat(49) })).toMatchObject({ issues: { name: 'too-long' } });
    expect(validateChampionshipDraft({ ...COMPLETE, durations: [] })).toMatchObject({ issues: { durations: 'required' } });
    expect(
      validateChampionshipDraft({ ...COMPLETE, durations: [1, 2, 3, 4].map((hours) => ({ hours, stintMinutes: 60, startTime: '20:00' })) }),
    ).toMatchObject({ issues: { durations: 'too-many' } });
    expect(validateChampionshipDraft({ ...COMPLETE, durations: [{ hours: 6, stintMinutes: 60, startTime: '20:00' }, { hours: 6, stintMinutes: 120, startTime: '20:00' }] })).toMatchObject({
      issues: { durations: 'repeated' },
    });
    expect(validateChampionshipDraft({ ...COMPLETE, carIds: [] })).toMatchObject({ issues: { carIds: 'required' } });
    expect(validateChampionshipDraft({ ...COMPLETE, carIds: [1, 1] })).toMatchObject({ issues: { carIds: 'repeated' } });
    expect(validateChampionshipDraft({ ...COMPLETE, carIds: [0] })).toMatchObject({ issues: { carIds: 'invalid' } });
  });

  it('una durata: ore intere 1–24, stint da 60 a 180 minuti che divide la gara, al massimo 12 stint', () => {
    expect(findDurationIssue(6, 60)).toBeNull();
    expect(findDurationIssue(24, 120)).toBeNull();
    expect(findDurationIssue(0, 60)).toBe('hours');
    expect(findDurationIssue(25, 60)).toBe('hours');
    expect(findDurationIssue(1.5, 60)).toBe('hours');
    expect(findDurationIssue(6, 59)).toBe('stint');
    expect(findDurationIssue(6, 181)).toBe('stint');
    expect(findDurationIssue(6, 70)).toBe('not-divisor');
    expect(findDurationIssue(13, 60)).toBe('too-many-stints');
  });

  it("orari degli stint dalla partenza, anche dopo la mezzanotte; nessuno senza partenza", () => {
    expect(stintStartTimes({ hours: 6, stintMinutes: 120, startTime: '21:30' })).toEqual(['21:30', '23:30', '01:30']);
    expect(stintStartTimes({ hours: 3, stintMinutes: 90, startTime: '23:00' })).toEqual(['23:00', '00:30']);
    expect(stintStartTimes({ hours: 3, stintMinutes: 90, startTime: null })).toEqual([]);
    expect(stintStartTimes({ hours: 3, stintMinutes: 90 })).toEqual([]);
    expect(addMinutesToClock('22:15', 24 * 60)).toBe('22:15');
  });

  it('i cambi pilota sono uno in meno degli stint', () => {
    expect(stintCount({ hours: 6, stintMinutes: 60 })).toBe(6);
    expect(driverSwapCountFor({ hours: 6, stintMinutes: 60 })).toBe(5);
    expect(driverSwapCountFor({ hours: 3, stintMinutes: 90 })).toBe(1);
    expect(driverSwapCountFor({ hours: 3, stintMinutes: 180 })).toBe(0);
    expect(driverSwapCountFor({ hours: 12, stintMinutes: 60 })).toBe(11);
  });

  it('trova un campionato senza badare a maiuscole e spazi', () => {
    expect(findChampionship(TEST_CHAMPIONSHIPS, ' cool1  FIE championship')?.id).toBe(1);
    expect(findChampionship(TEST_CHAMPIONSHIPS, 'Altro')).toBeUndefined();
  });
});
