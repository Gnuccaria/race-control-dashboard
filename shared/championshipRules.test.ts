import { describe, expect, it } from 'vitest';
import { matchCarLines } from './carRules';
import { driverSwapCountFor, findChampionship, findDurationIssue, stintCount, validateChampionshipDraft } from './championshipRules';
import { TEST_CHAMPIONSHIPS } from './testChampionships';

const COMPLETE = { name: '  GT3   Sprint Cup ', durations: [{ hours: 6, stintMinutes: 60 }, { hours: 3, stintMinutes: 90 }], carIds: [3, 1] };

describe('regole campionato', () => {
  it('convalida nome, durate (ore e stint) e vetture; durate in ordine crescente', () => {
    expect(validateChampionshipDraft(COMPLETE)).toEqual({
      isValid: true,
      championship: { name: 'GT3 Sprint Cup', durations: [{ hours: 3, stintMinutes: 90 }, { hours: 6, stintMinutes: 60 }], carIds: [3, 1] },
    });
    expect(validateChampionshipDraft({})).toEqual({ isValid: false, issues: { name: 'required', durations: 'invalid', carIds: 'invalid' } });
    expect(validateChampionshipDraft({ ...COMPLETE, name: '<b>' })).toMatchObject({ issues: { name: 'invalid-characters' } });
    expect(validateChampionshipDraft({ ...COMPLETE, name: 'x'.repeat(49) })).toMatchObject({ issues: { name: 'too-long' } });
    expect(validateChampionshipDraft({ ...COMPLETE, durations: [] })).toMatchObject({ issues: { durations: 'required' } });
    expect(
      validateChampionshipDraft({ ...COMPLETE, durations: [1, 2, 3, 4].map((hours) => ({ hours, stintMinutes: 60 })) }),
    ).toMatchObject({ issues: { durations: 'too-many' } });
    expect(validateChampionshipDraft({ ...COMPLETE, durations: [{ hours: 6, stintMinutes: 60 }, { hours: 6, stintMinutes: 120 }] })).toMatchObject({
      issues: { durations: 'repeated' },
    });
    expect(validateChampionshipDraft({ ...COMPLETE, carIds: [] })).toMatchObject({ issues: { carIds: 'required' } });
    expect(validateChampionshipDraft({ ...COMPLETE, carIds: [1, 1] })).toMatchObject({ issues: { carIds: 'repeated' } });
    expect(validateChampionshipDraft({ ...COMPLETE, carIds: [0] })).toMatchObject({ issues: { carIds: 'invalid' } });
  });

  it('una durata: ore intere 1–24, stint in minuti che divide la gara, al massimo 24 stint', () => {
    expect(findDurationIssue(6, 60)).toBeNull();
    expect(findDurationIssue(0, 60)).toBe('hours');
    expect(findDurationIssue(25, 60)).toBe('hours');
    expect(findDurationIssue(1.5, 30)).toBe('hours');
    expect(findDurationIssue(6, 0)).toBe('stint');
    expect(findDurationIssue(6, 7)).toBe('not-divisor');
    expect(findDurationIssue(6, 10)).toBe('too-many-stints');
  });

  it('i cambi pilota sono uno in meno degli stint', () => {
    expect(stintCount({ hours: 6, stintMinutes: 60 })).toBe(6);
    expect(driverSwapCountFor({ hours: 6, stintMinutes: 60 })).toBe(5);
    expect(driverSwapCountFor({ hours: 3, stintMinutes: 90 })).toBe(1);
    expect(driverSwapCountFor({ hours: 3, stintMinutes: 180 })).toBe(0);
  });

  it('trova un campionato senza badare a maiuscole e spazi', () => {
    expect(findChampionship(TEST_CHAMPIONSHIPS, ' cool1  FIE championship')?.id).toBe(1);
    expect(findChampionship(TEST_CHAMPIONSHIPS, 'Altro')).toBeUndefined();
  });

  it('riconosce le vetture scritte una per riga', () => {
    const cars = [
      { id: 1, manufacturer: 'Porsche', model: '911 GT3 R' },
      { id: 2, manufacturer: 'Ferrari', model: null },
    ];
    expect(matchCarLines('porsche  911 gt3 r\n\n Ferrari \nLancia\nFerrari', cars)).toEqual({ carIds: [1, 2], unknownLines: ['Lancia'] });
  });
});
