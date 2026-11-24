import { describe, expect, it } from 'vitest';
import { doQualifyingProtestsOverlapRace, openProtestSession, protestWindows, qualifyingInstants, readProtestTimes } from './protestTimingRules';

const race = { raceDate: '2026-11-20', startTime: '21:00', endDate: '2026-11-21', endTime: '03:00' };
// Qualifiche un giorno prima, 30 minuti, proteste fino a 1 ora dopo; gara con proteste fino a 48 ore dopo la fine.
const times = { qualifying: { advanceHours: 24, minutes: 30, protestHours: 1 }, raceProtestHours: 48 };

describe('finestre delle proteste', () => {
  it('qualifiche: dall’inizio fino alla finestra dopo la fine; gara: dall’inizio fino alla finestra dopo la fine', () => {
    expect(qualifyingInstants(race, times)).toEqual({ opensAt: Date.parse('2026-11-19T20:00:00Z'), closesAt: Date.parse('2026-11-19T20:30:00Z') });
    expect(protestWindows(race, times)).toEqual({
      qualifying: { opensAt: Date.parse('2026-11-19T20:00:00Z'), closesAt: Date.parse('2026-11-19T21:30:00Z') },
      race: { opensAt: Date.parse('2026-11-20T20:00:00Z'), closesAt: Date.parse('2026-11-23T02:00:00Z') },
    });
  });

  it('la sessione si deduce dall’orario di invio', () => {
    expect(openProtestSession(race, times, Date.parse('2026-11-19T19:59:59Z'))).toBeNull();
    expect(openProtestSession(race, times, Date.parse('2026-11-19T20:00:00Z'))).toBe('qualifying');
    expect(openProtestSession(race, times, Date.parse('2026-11-19T21:30:00Z'))).toBe('qualifying');
    expect(openProtestSession(race, times, Date.parse('2026-11-19T21:30:01Z'))).toBeNull();
    expect(openProtestSession(race, times, Date.parse('2026-11-20T20:00:00Z'))).toBe('race');
    expect(openProtestSession(race, times, Date.parse('2026-11-23T02:00:00Z'))).toBe('race');
    expect(openProtestSession(race, times, Date.parse('2026-11-23T02:00:01Z'))).toBeNull();
    // Campionato salvato prima: niente qualifiche, solo la gara.
    expect(openProtestSession(race, { qualifying: null, raceProtestHours: 48 }, Date.parse('2026-11-19T20:10:00Z'))).toBeNull();
    expect(openProtestSession({ raceDate: '2026-11-20', startTime: null, endDate: null, endTime: null }, times)).toBeNull();
  });

  it('convalida: valori dei menu, tutti obbligatori, finestre senza sovrapposizioni', () => {
    expect(readProtestTimes(times)).toEqual({ isValid: true, times });
    expect(readProtestTimes({ ...times, raceProtestHours: 3 })).toEqual({ isValid: false, issue: 'raceProtestHours' });
    expect(readProtestTimes({ ...times, qualifying: { ...times.qualifying, advanceHours: 5 } })).toEqual({ isValid: false, issue: 'qualifyingAdvanceHours' });
    expect(readProtestTimes({ raceProtestHours: 48 })).toEqual({ isValid: false, issue: 'qualifyingAdvanceHours' });
    // Qualifiche un'ora prima della gara, 30 minuti + 1 ora di proteste: finirebbero dopo la partenza.
    const tight = { advanceHours: 1, minutes: 30, protestHours: 1 };
    expect(doQualifyingProtestsOverlapRace(tight)).toBe(true);
    expect(readProtestTimes({ ...times, qualifying: tight })).toEqual({ isValid: false, issue: 'overlap' });
    expect(doQualifyingProtestsOverlapRace({ advanceHours: 2, minutes: 60, protestHours: 1 })).toBe(false);
  });
});
