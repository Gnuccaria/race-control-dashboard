import type { SavedCrew } from '@shared/crewRules';
import type { RaceSummary, SavedRace } from '@shared/raceRules';
import { describe, expect, it } from 'vitest';
import {
  computeDriverSwapSheet,
  type DriverSwapRowValues,
  type DriverSwapValues,
  EMPTY_DRIVER_SWAP_ROW,
  EMPTY_DRIVER_SWAP_VALUES,
  invalidCellKey,
  toDriverSwapValues,
} from './driverSwapDraft';
import {
  checkRaceDraft,
  EMPTY_RACE_VALUES,
  findChampionshipCrews,
  keepChampionshipCrews,
  toRaceDraftValues,
  toRaceResults,
  validateRaceValues,
} from './raceDraft';
import {
  DEFAULT_RACE_SORT,
  EMPTY_RACE_FILTERS,
  filterRaces,
  hasActiveRaceFilters,
  listRaceTrackOptions,
  sortRaces,
  toggleRaceSort,
} from './raceList';

const CHAMPIONSHIP = 'Cool1 FIE Championship' as const;

const summary = (id: number, round: number, raceDate: string, trackName: string | null = null): RaceSummary => ({
  id,
  name: null,
  championship: CHAMPIONSHIP,
  duration: '6 hours',
  totalLaps: null,
  round,
  trackId: trackName ? id : null,
  trackName,
  trackConfiguration: null,
  isTrackReversed: false,
  raceDate,
  updatedAt: `2026-11-${String(id).padStart(2, '0')}T10:00:00Z`,
});

const RACES = [summary(1, 1, '2026-09-10', 'Monza'), summary(2, 3, '2026-11-05'), summary(3, 2, '2026-10-01', 'Imola')];

describe('elenco gare', () => {
  it('di default mostra prima le gare più recenti', () => {
    expect(sortRaces(RACES, DEFAULT_RACE_SORT, 'it').map((race) => race.id)).toEqual([2, 3, 1]);
  });

  it('ordina per round e per tracciato (senza tracciato in fondo)', () => {
    const byRound = toggleRaceSort(DEFAULT_RACE_SORT, 'round');
    expect(sortRaces(RACES, byRound, 'it').map((race) => race.round)).toEqual([1, 2, 3]);
    expect(sortRaces(RACES, toggleRaceSort(byRound, 'round'), 'it').map((race) => race.round)).toEqual([3, 2, 1]);
    expect(sortRaces(RACES, { column: 'track', direction: 'ascending' }, 'it').map((race) => race.trackName)).toEqual([
      'Imola',
      'Monza',
      null,
    ]);
  });

  it('propone nel filtro Tracciato solo le piste usate, una volta ciascuna, in ordine alfabetico', () => {
    const races = [summary(1, 1, '2026-01-10', 'Spa'), summary(2, 2, '2026-02-10', 'Monza'), summary(1, 3, '2026-03-10', 'Spa'), summary(4, 4, '2026-04-10', null)];
    expect(listRaceTrackOptions(races, (race) => race.trackName ?? '', 'it')).toEqual([
      { value: '2', label: 'Monza' },
      { value: '1', label: 'Spa' },
    ]);
    expect(filterRaces(races, { ...EMPTY_RACE_FILTERS, trackId: '1' }).map((race) => race.round)).toEqual([1, 3]);
  });

  it('filtra per intervallo di date, estremi inclusi', () => {
    expect(filterRaces(RACES, { ...EMPTY_RACE_FILTERS, fromDate: '2026-10-01' }).map((race) => race.id)).toEqual([2, 3]);
    expect(filterRaces(RACES, { ...EMPTY_RACE_FILTERS, toDate: '2026-10-01' }).map((race) => race.id)).toEqual([1, 3]);
    expect(filterRaces(RACES, { ...EMPTY_RACE_FILTERS, championship: CHAMPIONSHIP, fromDate: '2026-12-01' })).toEqual([]);
    expect(hasActiveRaceFilters({ ...EMPTY_RACE_FILTERS, toDate: '2026-10-01' })).toBe(true);
  });
});

const crew = (id: number, number: number, championship: SavedCrew['championship']): SavedCrew => ({
  id,
  name: `Team ${id}`,
  number,
  carId: 1,
  championship,
  color: '#E10600',
  createdAt: '2026-11-13T00:00:00Z',
});

describe('form della gara', () => {
  const completeValues = {
    name: '',
    championship: CHAMPIONSHIP,
    duration: '6 hours',
    totalLapsText: '',
    roundText: '4',
    raceDate: '2026-11-08',
    trackId: null,
    isTrackReversed: false,
    crewIdByPosition: [7, null, 9, ...Array.from({ length: 11 }, () => null)],
    lapsTextByPosition: ['25', '', '24', ...Array.from({ length: 11 }, () => '')],
    gapTextByPosition: ['', '', '1:05,320', ...Array.from({ length: 11 }, () => '')],
    savedResults: [],
    driverSwap: EMPTY_DRIVER_SWAP_VALUES,
  } as const;

  it('richiede la durata nel Cool1 FIE Championship e controlla il nome', () => {
    expect(checkRaceDraft({ ...completeValues, duration: '' })).toMatchObject({ isDurationRequired: true, isComplete: false });
    expect(checkRaceDraft({ ...completeValues, name: '<b>' })).toMatchObject({ isNameInvalid: true, hasInfoErrors: true, isComplete: false });
    expect(validateRaceValues({ ...completeValues, name: ' 6 Ore ' })).toMatchObject({ isValid: true, race: { name: '6 Ore', duration: '6 hours' } });
  });

  it('controlla i giri totali e i giri che li superano', () => {
    expect(checkRaceDraft({ ...completeValues, totalLapsText: '0' })).toMatchObject({ isTotalLapsInvalid: true, hasInfoErrors: true, isComplete: false });
    expect(checkRaceDraft({ ...completeValues, totalLapsText: '24' })).toMatchObject({ positionsOverTotalLaps: [1], hasResultsErrors: true, isComplete: false });
    expect(validateRaceValues({ ...completeValues, totalLapsText: '25' })).toMatchObject({ isValid: true, race: { totalLaps: 25 } });
  });

  it('decide la vettura di ogni riga e blocca gli equipaggi senza auto', () => {
    const cars = new Map<number, number | null>([[7, 3], [9, null]]);
    expect(checkRaceDraft(completeValues, undefined, cars)).toMatchObject({ positionsWithoutCar: [3], hasResultsErrors: true, isComplete: false });
    // L'equipaggio 9 era già in P3 con un'auto salvata: la riga invariata la tiene.
    const saved = checkRaceDraft({ ...completeValues, savedResults: [{ position: 3, crewId: 9, laps: 24, gapMs: null, carId: 5 }] }, undefined, cars);
    expect([...saved.carIdByPosition]).toEqual([[1, 3], [3, 5]]);
    expect(saved.isComplete).toBe(true);
  });

  it('è completo con campionato, round e data validi; le righe vuote sono ammesse', () => {
    expect(checkRaceDraft(EMPTY_RACE_VALUES).isComplete).toBe(false);
    expect(checkRaceDraft(completeValues)).toMatchObject({ isComplete: true, hasInfoErrors: false, hasResultsErrors: false });
    expect(toRaceResults(completeValues)).toEqual([
      { position: 1, crewId: 7, laps: 25, gapMs: null },
      { position: 3, crewId: 9, laps: 24, gapMs: 65_320 },
    ]);
    expect(validateRaceValues(completeValues)).toMatchObject({ isValid: true, race: { round: 4, trackId: null } });
  });

  it('richiede i giri completati per ogni equipaggio inserito', () => {
    const missingLaps = checkRaceDraft({ ...completeValues, lapsTextByPosition: ['25', '', '', ...Array.from({ length: 11 }, () => '')] });
    expect(missingLaps).toMatchObject({ positionsMissingLaps: [3], isComplete: false });
  });

  it('il distacco è facoltativo ma, se scritto, deve essere minuti:secondi,millesimi', () => {
    // La posizione 2 è vuota, quindi il testo lì non conta; in posizione 3 "1:65" non è valido.
    const invalidGap = checkRaceDraft({ ...completeValues, gapTextByPosition: ['', 'abc', '1:65', ...Array.from({ length: 11 }, () => '')] });
    expect(invalidGap).toMatchObject({ positionsWithInvalidGap: [3], hasResultsErrors: true, isComplete: false });
    expect(validateRaceValues({ ...completeValues, gapTextByPosition: Array.from({ length: 14 }, () => '') })).toMatchObject({ isValid: true });
  });

  it('il primo non ha distacco: un testo rimasto nella sua riga non conta e non viene salvato', () => {
    const leaderText = { ...completeValues, gapTextByPosition: ['abc', ...Array.from({ length: 13 }, () => '')] };
    expect(checkRaceDraft(leaderText)).toMatchObject({ positionsWithInvalidGap: [], isComplete: true });
    expect(toRaceResults({ ...leaderText, gapTextByPosition: ['1:00', ...Array.from({ length: 13 }, () => '')] })[0]).toMatchObject({ position: 1, gapMs: null });
  });

  it('segnala round non valido ed equipaggi ripetuti', () => {
    expect(checkRaceDraft({ ...completeValues, roundText: '0' })).toMatchObject({ isRoundInvalid: true, isComplete: false });
    // Data nel futuro rispetto a "oggi": errore in Anagrafica e salvataggio bloccato.
    expect(checkRaceDraft(completeValues, '2026-11-08')).toMatchObject({ isRaceDateInFuture: false, isComplete: true });
    expect(checkRaceDraft(completeValues, '2026-11-07')).toMatchObject({ isRaceDateInFuture: true, hasInfoErrors: true, isComplete: false });
    expect(validateRaceValues(completeValues, '2026-11-07')).toMatchObject({ isValid: false, issues: { raceDate: 'future' } });
    const repeated = checkRaceDraft({
      ...completeValues,
      crewIdByPosition: [7, 9, 7, ...Array.from({ length: 11 }, () => null)],
      lapsTextByPosition: ['25', '25', '24', ...Array.from({ length: 11 }, () => '')],
    });
    expect([...repeated.repeatedPositions]).toEqual([[3, 1]]);
    expect(repeated).toMatchObject({ hasResultsErrors: true, isComplete: false });
  });

  it('propone solo gli equipaggi del campionato e toglie gli altri cambiando campionato', () => {
    const crews = [crew(1, 20, CHAMPIONSHIP), crew(2, 5, null), crew(3, 7, CHAMPIONSHIP)];
    const championshipCrews = findChampionshipCrews(crews, CHAMPIONSHIP);
    expect(championshipCrews.map((championshipCrew) => championshipCrew.number)).toEqual([7, 20]);
    expect(findChampionshipCrews(crews, '')).toEqual([]);
    expect(keepChampionshipCrews([1, 2, null, 3], championshipCrews)).toEqual([1, null, null, 3]);
  });

  it('riporta nel form una gara salvata', () => {
    const savedRace: SavedRace = {
      ...summary(1, 2, '2026-10-01'),
      results: [
        { position: 2, crewId: 9, laps: 31, gapMs: 12_045, carId: 3 },
        { position: 3, crewId: 4, laps: null, gapMs: null, carId: null },
      ],
      driverSwaps: [{ swap: 1, crewId: 9, pitInMs: 1_000, pitOutMs: null, penaltyMs: null, isCancelled: false, notes: '' }],
    };
    const values = toRaceDraftValues(savedRace);
    expect(values).toMatchObject({ championship: CHAMPIONSHIP, roundText: '2', raceDate: '2026-10-01' });
    expect(values.crewIdByPosition.slice(0, 4)).toEqual([null, 9, 4, null]);
    expect(values.lapsTextByPosition.slice(0, 4)).toEqual(['', '31', '', '']);
    expect(values.gapTextByPosition.slice(0, 4)).toEqual(['', '12,045', '', '']);
    expect(toRaceDraftValues(savedRace, '.').gapTextByPosition[1]).toBe('12.045');
    expect(values.driverSwap).toEqual({ rowsBySwap: [{ 9: { pitInText: '00:00:01.000', pitOutText: '', isCancelled: false, notes: '' } }] });
  });
});

describe('cambi pilota nel form', () => {
  const row = (pitInText: string, pitOutText: string, change: Partial<DriverSwapRowValues> = {}): DriverSwapRowValues => ({
    ...EMPTY_DRIVER_SWAP_ROW,
    pitInText,
    pitOutText,
    ...change,
  });

  it('riporta nel form le righe salvate con i tempi in HH:MM:SS.DDD', () => {
    expect(
      toDriverSwapValues([
        { swap: 2, crewId: 9, pitInMs: 8_000_642, pitOutMs: null, penaltyMs: null, isCancelled: true, notes: 'Crash' },
      ]),
    ).toEqual({ rowsBySwap: [{}, { 9: { pitInText: '02:13:20.642', pitOutText: '', isCancelled: true, notes: 'Crash' } }] });
  });

  it('calcola penalità e totali, segnala i tempi non validi e prepara le righe compilate da salvare', () => {
    const values: DriverSwapValues = {
      rowsBySwap: [
        { 1: row('1:00:00', '0:10:00'), 2: row('1:00:10', '0:10:05') },
        { 1: row('2:00:00', '1:10:00'), 2: row('2:00:04', '1:10:00', { isCancelled: true }), 3: row('abc', ''), 4: row('', '', { notes: ' Ritirata ' }) },
      ],
    };
    const sheet = computeDriverSwapSheet(values, [1, 2, 3, 4, 5], 5);
    // Margine 2 s e coefficiente 2,5 fissi: 2,5 × (10 − 5 − 2) s.
    expect(sheet.checksBySwap[0]?.get(2)).toMatchObject({ isPenalty: true, penaltyMs: 7_500 });
    expect(sheet.checksBySwap[1]?.get(2)).toMatchObject({ isPenalty: true, penaltyMs: 5_000, isCancelled: true });
    expect([...sheet.invalidCells]).toEqual([invalidCellKey(1, 3, 'pitIn')]);
    expect([...sheet.swapsWithErrors]).toEqual([1]);
    expect(sheet).toMatchObject({ hasErrors: true, totals: [{ crewId: 2, penaltyMs: 7_500 }] });
    // Si salvano solo le righe compilate (anche solo con una nota), mai la 5 vuota.
    expect(sheet.entries.map(({ swap, crewId, notes }) => ({ swap, crewId, notes }))).toEqual([
      { swap: 1, crewId: 1, notes: '' },
      { swap: 1, crewId: 2, notes: '' },
      { swap: 2, crewId: 1, notes: '' },
      { swap: 2, crewId: 2, notes: '' },
      { swap: 2, crewId: 3, notes: '' },
      { swap: 2, crewId: 4, notes: 'Ritirata' },
    ]);
  });

  it('il form passa al server le righe e blocca il salvataggio con tempi non validi', () => {
    const raceValues = { ...EMPTY_RACE_VALUES, championship: CHAMPIONSHIP, duration: '6 hours' as const, roundText: '4', raceDate: '2026-11-08' };
    const values = { ...raceValues, driverSwap: { rowsBySwap: [{ 7: row('1:0', '') }] } };
    const sheet = computeDriverSwapSheet(values.driverSwap, [7, 9], 5);
    expect(checkRaceDraft(values, undefined, undefined, sheet)).toMatchObject({ hasDriverSwapErrors: true, isComplete: false });
    const entries = [{ swap: 1, crewId: 7, pitInMs: 1_000, pitOutMs: 2_000, isCancelled: false, notes: '' }];
    expect(validateRaceValues(raceValues, undefined, entries)).toMatchObject({ isValid: true, race: { driverSwaps: entries } });
  });
});
