import { describe, expect, it } from 'vitest';
import { hasRaceStarted, isProtestWindowOpen, protestWindow, raceInstants, romeLocalToInstant } from './raceSchedule';

describe('orari delle gare in ora italiana', () => {
  it('converte l’ora italiana nell’istante giusto, d’inverno e d’estate', () => {
    expect(new Date(romeLocalToInstant('2026-11-20', '21:00') ?? 0).toISOString()).toBe('2026-11-20T20:00:00.000Z');
    expect(new Date(romeLocalToInstant('2026-07-20', '21:00') ?? 0).toISOString()).toBe('2026-07-20T19:00:00.000Z');
    // Il giorno del cambio dell'ora (ultima domenica di ottobre).
    expect(new Date(romeLocalToInstant('2026-10-25', '12:00') ?? 0).toISOString()).toBe('2026-10-25T11:00:00.000Z');
    expect(romeLocalToInstant('2026-11-20', '25:00')).toBeNull();
    expect(romeLocalToInstant('20/11/2026', '21:00')).toBeNull();
  });

  it('la fine può essere il giorno dopo (gara di 12 ore)', () => {
    expect(raceInstants({ raceDate: '2026-11-20', startTime: '20:00', endDate: '2026-11-21', endTime: '08:00' })).toEqual({
      startsAt: Date.parse('2026-11-20T19:00:00Z'),
      endsAt: Date.parse('2026-11-21T07:00:00Z'),
    });
    expect(raceInstants({ raceDate: '2026-11-20', startTime: null, endDate: null, endTime: null })).toBeNull();
  });

  it('proteste aperte dall’inizio della gara fino a 48 ore esatte dopo la fine', () => {
    const race = { raceDate: '2026-11-20', startTime: '21:00', endDate: '2026-11-21', endTime: '03:00' };
    expect(protestWindow(race)).toEqual({ opensAt: Date.parse('2026-11-20T20:00:00Z'), closesAt: Date.parse('2026-11-23T02:00:00Z') });
    expect(isProtestWindowOpen(race, Date.parse('2026-11-20T19:59:59Z'))).toBe(false);
    expect(isProtestWindowOpen(race, Date.parse('2026-11-20T20:00:00Z'))).toBe(true);
    expect(isProtestWindowOpen(race, Date.parse('2026-11-23T02:00:00Z'))).toBe(true);
    expect(isProtestWindowOpen(race, Date.parse('2026-11-23T02:00:01Z'))).toBe(false);
    expect(isProtestWindowOpen({ raceDate: '2026-11-20', startTime: null, endDate: null, endTime: null })).toBe(false);
  });

  it('una gara è cominciata dall’ora di inizio; senza orari dal giorno della gara', () => {
    const race = { raceDate: '2026-11-20', startTime: '21:00', endDate: '2026-11-20', endTime: '23:00' };
    expect(hasRaceStarted(race, Date.parse('2026-11-20T19:00:00Z'))).toBe(false);
    expect(hasRaceStarted(race, Date.parse('2026-11-20T20:00:00Z'))).toBe(true);
    const legacy = { raceDate: '2026-11-20', startTime: null, endDate: null, endTime: null };
    expect(hasRaceStarted(legacy, Date.parse('2026-11-19T22:59:00Z'))).toBe(false);
    expect(hasRaceStarted(legacy, Date.parse('2026-11-19T23:00:00Z'))).toBe(true);
  });
});
