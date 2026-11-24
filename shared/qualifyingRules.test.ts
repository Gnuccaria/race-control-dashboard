import { describe, expect, it } from 'vitest';
import { canPositionHaveQ2, formatLapTime, parseLapTimeText, readQualifying } from './qualifyingRules';
import { validateRaceDraft } from './raceRules';
import { TEST_CHAMPIONSHIPS } from './testChampionships';

describe('qualifiche', () => {
  it('tempo Q2 solo nelle posizioni 1–4 e 8–11', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].filter(canPositionHaveQ2)).toEqual([1, 2, 3, 4, 8, 9, 10, 11]);
  });

  it('miglior giro scritto con punto o virgola, mostrato sempre come M:SS.DDD', () => {
    expect(parseLapTimeText('1:58.432')).toBe(118_432);
    expect(parseLapTimeText('1:58,432')).toBe(118_432);
    expect(parseLapTimeText('58.4')).toBe(58_400);
    expect(parseLapTimeText('')).toBeNull();
    expect(parseLapTimeText('1:75.000')).toBeNaN();
    expect(parseLapTimeText('60:00.000')).toBeNaN();
    expect(formatLapTime(118_432)).toBe('1:58.432');
    expect(formatLapTime(58_400)).toBe('0:58.400');
  });

  it('convalida: posizioni uniche, tempi validi, Q2 solo dove previsto; assenti = nessuna', () => {
    expect(readQualifying(undefined)).toEqual([]);
    expect(readQualifying([{ position: 2, crewId: 5, q1Ms: 118_432, q2Ms: null }, { position: 1, crewId: 3, q1Ms: null, q2Ms: 117_900 }])).toEqual([
      { position: 1, crewId: 3, q1Ms: null, q2Ms: 117_900 },
      { position: 2, crewId: 5, q1Ms: 118_432, q2Ms: null },
    ]);
    expect(readQualifying([{ position: 5, crewId: 3, q1Ms: 118_000, q2Ms: 117_000 }])).toBeNull();
    expect(readQualifying([{ position: 15, crewId: 3 }])).toBeNull();
    expect(readQualifying([{ position: 1, crewId: 3, q1Ms: 0 }])).toBeNull();
    expect(readQualifying([{ position: 1, crewId: 3 }, { position: 1, crewId: 4 }])).toBeNull();
  });

  it('nella gara: un equipaggio in due posizioni delle qualifiche è un errore', () => {
    const race = {
      championship: 'All Japan GT Championship',
      duration: 3,
      round: 1,
      raceDate: '2026-11-08',
      startTime: '21:00',
      endDate: '2026-11-08',
      endTime: '23:30',
      results: [],
      qualifying: [
        { position: 1, crewId: 3, q1Ms: 118_000, q2Ms: null },
        { position: 2, crewId: 3, q1Ms: 118_500, q2Ms: null },
      ],
    };
    expect(validateRaceDraft(race, TEST_CHAMPIONSHIPS)).toMatchObject({ isValid: false, issues: { qualifying: 'repeated-crew' } });
    expect(validateRaceDraft({ ...race, qualifying: undefined }, TEST_CHAMPIONSHIPS)).toMatchObject({ isValid: true, race: { qualifying: [] } });
  });
});
