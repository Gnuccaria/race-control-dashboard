import { describe, expect, it } from 'vitest';
import {
  onlyRaceDurationFor,
  raceDurationsFor,
  findRepeatedCrewPositions,
  isIsoDate,
  normalizeTrackName,
  parseLaps,
  parseRound,
  sanitizeLapsInput,
  formatGap,
  parseGapText,
  RACE_GAP_MAX_MS,
  resolveResultCars,
  sanitizeGapInput,
  sanitizeRoundInput,
  todayIsoDate,
  validateRaceDraft,
} from './raceRules';

/** Orari in ora italiana, obbligatori. */
const SCHEDULE = { startTime: '21:00', endDate: '2026-11-08', endTime: '23:30' };

const COMPLETE_RACE = {
  ...SCHEDULE,
  name: '  6 Ore   di Monza ',
  championship: 'Cool1 FIE Championship',
  duration: '6 hours',
  round: 3,
  trackId: null,
  raceDate: '2026-11-08',
  results: [
    { position: 2, crewId: 8, laps: 24 },
    { position: 1, crewId: 5, laps: 25 },
  ],
};

describe('regole gara', () => {
  it('nel campo Round tiene solo cifre, al massimo due, da 1 a 99', () => {
    expect(sanitizeRoundInput('r1x2-3')).toBe('12');
    expect(parseRound('7')).toBe(7);
    expect(parseRound('07')).toBe(7);
    expect(parseRound('0')).toBeNull();
    expect(parseRound('')).toBeNull();
  });

  it('nel campo Giri completati tiene solo cifre, al massimo tre', () => {
    expect(sanitizeLapsInput('2a5.7x9')).toBe('257');
    expect(parseLaps('0')).toBe(0);
    expect(parseLaps('42')).toBe(42);
    expect(parseLaps('')).toBeNull();
  });

  it('accetta solo date reali in formato AAAA-MM-GG', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('20/11/2026')).toBe(false);
  });

  it('ammette le gare future; orari di inizio e fine obbligatori, con la fine dopo l’inizio', () => {
    const base = { championship: 'Cool1 FIE Championship', duration: '12 hours', round: 1, results: [], raceDate: '2099-01-01' };
    expect(validateRaceDraft({ ...base, startTime: '20:00', endDate: '2099-01-02', endTime: '08:00' })).toMatchObject({
      isValid: true,
      race: { raceDate: '2099-01-01', startTime: '20:00', endDate: '2099-01-02', endTime: '08:00' },
    });
    expect(validateRaceDraft(base)).toEqual({ isValid: false, issues: { startTime: 'invalid', endDate: 'invalid', endTime: 'invalid' } });
    expect(validateRaceDraft({ ...base, startTime: '20:00', endDate: '2099-01-01', endTime: '20:00' })).toEqual({ isValid: false, issues: { endTime: 'before-start' } });
    expect(validateRaceDraft({ ...base, startTime: '20:00', endDate: '2098-12-31', endTime: '23:00' })).toEqual({ isValid: false, issues: { endTime: 'before-start' } });
    expect(validateRaceDraft({ ...base, startTime: '24:00', endDate: '2099-01-01', endTime: '9:00' })).toEqual({ isValid: false, issues: { startTime: 'invalid', endTime: 'invalid' } });
  });

  it('al contrario solo con una pista indicata', () => {
    const base = { championship: 'Cool1 FIE Championship', duration: '6 hours', round: 1, raceDate: '2026-11-01', ...SCHEDULE, endDate: '2026-11-01', results: [] };
    expect(validateRaceDraft({ ...base, trackId: 4, isTrackReversed: true })).toMatchObject({ isValid: true, race: { trackId: 4, isTrackReversed: true } });
    expect(validateRaceDraft({ ...base, trackId: null, isTrackReversed: true })).toEqual({ isValid: false, issues: { trackId: 'reverse-unavailable' } });
    expect(validateRaceDraft({ ...base, trackId: 4, isTrackReversed: 'sì' })).toEqual({ isValid: false, issues: { trackId: 'invalid' } });
    expect(validateRaceDraft(base)).toMatchObject({ isValid: true, race: { trackId: null, isTrackReversed: false } });
  });

  it('legge e scrive il distacco come minuti:secondi,millesimi', () => {
    expect(parseGapText('')).toBeNull();
    expect(parseGapText('1:05,320')).toBe(65_320);
    expect(parseGapText('1:05.3')).toBe(65_300);
    expect(parseGapText('12,5')).toBe(12_500);
    expect(parseGapText('75')).toBe(75_000);
    expect(parseGapText('999:59,999')).toBe(RACE_GAP_MAX_MS);
    for (const invalid of ['1:65', '1:5', ':05', '1,2,3', '1000:00']) expect(Number.isNaN(parseGapText(invalid))).toBe(true);
    expect(sanitizeGapInput('+1m:05,3s20')).toBe('1:05,320');
    expect(formatGap(65_320, ',')).toBe('1:05,320');
    expect(formatGap(12_045, '.')).toBe('12.045');
  });

  it('calcola la data di oggi nel fuso orario richiesto', () => {
    const lateEveningInRome = new Date('2026-11-13T23:30:00Z'); // 00:30 del 14 a Roma
    expect(todayIsoDate(lateEveningInRome, 'UTC')).toBe('2026-11-13');
    expect(todayIsoDate(lateEveningInRome, 'Europe/Rome')).toBe('2026-11-14');
    expect(todayIsoDate(lateEveningInRome, 'Pacific/Kiritimati')).toBe('2026-11-14');
  });

  it('trova gli equipaggi ripetuti in classifica, indicando la prima posizione', () => {
    const repeated = findRepeatedCrewPositions([
      { position: 5, crewId: 9 },
      { position: 1, crewId: 9 },
      { position: 2, crewId: 4 },
      { position: 7, crewId: 9 },
    ]);
    expect([...repeated]).toEqual([
      [5, 1],
      [7, 1],
    ]);
  });

  it('convalida una gara completa e ordina la classifica per posizione', () => {
    expect(validateRaceDraft(COMPLETE_RACE)).toEqual({
      isValid: true,
      race: {
        ...COMPLETE_RACE,
        name: '6 Ore di Monza',
        totalLaps: null,
        isTrackReversed: false,
        results: [
          { position: 1, crewId: 5, laps: 25, gapMs: null },
          { position: 2, crewId: 8, laps: 24, gapMs: null },
        ],
        // Senza cambi pilota indicati: nessuna penalità.
        driverSwaps: [],
      },
    });
    expect(validateRaceDraft({ ...COMPLETE_RACE, results: [] })).toMatchObject({ isValid: true });
  });

  it('elenca i problemi: campionato, round, data, pista, classifica', () => {
    expect(validateRaceDraft({ round: 0, raceDate: '2026-13-01', trackId: 'x', results: 'no' })).toEqual({
      isValid: false,
      issues: {
        championship: 'required',
        round: 'invalid',
        trackId: 'invalid',
        raceDate: 'invalid',
        startTime: 'invalid',
        endDate: 'invalid',
        endTime: 'invalid',
        results: 'invalid',
      },
    });
    // Durata: sempre obbligatoria, tra quelle del campionato; nome facoltativo ma valido.
    expect(validateRaceDraft({ ...COMPLETE_RACE, duration: undefined })).toEqual({ isValid: false, issues: { duration: 'required' } });
    expect(validateRaceDraft({ ...COMPLETE_RACE, duration: '24 hours' })).toEqual({ isValid: false, issues: { duration: 'invalid' } });
    expect(validateRaceDraft({ ...COMPLETE_RACE, duration: '3 hours' })).toEqual({ isValid: false, issues: { duration: 'invalid' } });
    expect(validateRaceDraft({ ...COMPLETE_RACE, championship: 'All Japan GT Championship', duration: '6 hours', results: [], driverSwaps: [] })).toEqual({
      isValid: false,
      issues: { duration: 'invalid' },
    });
    expect(validateRaceDraft({ ...COMPLETE_RACE, championship: 'All Japan GT Championship', duration: null, results: [], driverSwaps: [] })).toEqual({
      isValid: false,
      issues: { duration: 'required' },
    });
    expect(
      validateRaceDraft({ ...COMPLETE_RACE, championship: 'All Japan GT Championship', duration: '3 hours', results: [], driverSwaps: [] }),
    ).toMatchObject({ isValid: true, race: { duration: '3 hours' } });
    expect(raceDurationsFor('Cool1 FIE Championship')).toEqual(['6 hours', '12 hours']);
    expect(onlyRaceDurationFor('All Japan GT Championship')).toBe('3 hours');
    expect(onlyRaceDurationFor('Cool1 FIE Championship')).toBeNull();
    expect(validateRaceDraft({ ...COMPLETE_RACE, name: '<script>' })).toEqual({ isValid: false, issues: { name: 'invalid' } });
    expect(validateRaceDraft({ ...COMPLETE_RACE, name: '   ' })).toMatchObject({ isValid: true, race: { name: null } });
    // Giri totali: facoltativi, interi 1–999, mai meno dei giri completati da un equipaggio.
    expect(validateRaceDraft({ ...COMPLETE_RACE, totalLaps: 0 })).toEqual({ isValid: false, issues: { totalLaps: 'invalid' } });
    expect(validateRaceDraft({ ...COMPLETE_RACE, totalLaps: 1 })).toEqual({ isValid: false, issues: { totalLaps: 'exceeded' } });
    expect(validateRaceDraft({ ...COMPLETE_RACE, totalLaps: 200 })).toMatchObject({ isValid: true, race: { totalLaps: 200 } });
    expect(
      validateRaceDraft({ ...COMPLETE_RACE, results: [{ position: 1, crewId: 5, laps: 3 }, { position: 2, crewId: 5, laps: 3 }] }),
    ).toEqual({ isValid: false, issues: { results: 'repeated-crew' } });
    for (const invalidResults of [
      [{ position: 15, crewId: 5, laps: 3 }],
      [{ position: 1, crewId: 5, laps: 3 }, { position: 1, crewId: 6, laps: 3 }],
      [{ position: 1, crewId: 5 }],
      [{ position: 1, crewId: 5, laps: 1000 }],
      [{ position: 1, crewId: 5, laps: 2.5 }],
    ]) {
      expect(validateRaceDraft({ ...COMPLETE_RACE, results: invalidResults })).toMatchObject({ isValid: false });
    }
  });

  it('vettura di ogni riga: invariata tiene quella salvata, nuova o cambiata prende quella attuale', () => {
    const saved = [
      { position: 1, crewId: 5, carId: 3 },
      { position: 2, crewId: 8, carId: 6 },
    ];
    // Nel frattempo l'equipaggio 5 è passato dall'auto 3 alla 4; l'equipaggio 9 non ha un'auto.
    const current = new Map<number, number | null>([[5, 4], [8, 6], [7, 2], [9, null]]);
    const unchanged = resolveResultCars([{ position: 1, crewId: 5 }, { position: 2, crewId: 8 }], saved, current);
    expect([...unchanged.carIdByPosition]).toEqual([[1, 3], [2, 6]]);
    // L'equipaggio 5 cambia posizione: ora prende l'auto attuale. In P1 arriva un equipaggio nuovo.
    const moved = resolveResultCars([{ position: 1, crewId: 7 }, { position: 3, crewId: 5 }, { position: 4, crewId: 9 }], saved, current);
    expect([...moved.carIdByPosition]).toEqual([[1, 2], [3, 4], [4, null]]);
    expect(moved.positionsWithoutCar).toEqual([4]);
  });

  it('normalizza i nomi delle piste e rifiuta quelli non validi', () => {
    expect(normalizeTrackName('  Spa-Francorchamps ')).toBe('Spa-Francorchamps');
    expect(normalizeTrackName("Circuit  de l'Eau Rouge")).toBe("Circuit de l'Eau Rouge");
    expect(normalizeTrackName('')).toBeNull();
    expect(normalizeTrackName('<script>')).toBeNull();
    expect(normalizeTrackName('a'.repeat(65))).toBeNull();
  });
});
