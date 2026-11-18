import { describe, expect, it } from 'vitest';
import {
  checkDriverSwap,
  type DriverSwapEntry,
  formatRaceTimestamp,
  normalizeTimestampText,
  parseRaceTimestamp,
  readDriverSwaps,
  totalDriverSwapPenalties,
  withDriverSwapPenalties,
} from './driverSwapRules';
import { driverSwapCountOf } from './championshipRules';
import { TEST_CHAMPIONSHIPS } from './testChampionships';

const entry = (crewId: number, pitIn: string, pitOut: string, overrides: Partial<DriverSwapEntry> = {}): DriverSwapEntry => ({
  swap: 1,
  crewId,
  pitInMs: parseRaceTimestamp(pitIn),
  pitOutMs: parseRaceTimestamp(pitOut),
  isCancelled: false,
  notes: '',
  ...overrides,
});

const isInvalid = (text: string) => Number.isNaN(parseRaceTimestamp(text));

describe('cambi pilota', () => {
  it('gli stint della durata decidono quanti cambi ci sono', () => {
    expect(driverSwapCountOf(TEST_CHAMPIONSHIPS, 'Cool1 FIE Championship', 6)).toBe(5);
    expect(driverSwapCountOf(TEST_CHAMPIONSHIPS, 'Cool1 FIE Championship', 12)).toBe(5);
    expect(driverSwapCountOf(TEST_CHAMPIONSHIPS, 'All Japan GT Championship', 3)).toBe(1);
    expect(driverSwapCountOf(TEST_CHAMPIONSHIPS, 'Cool1 FIE Championship', null)).toBe(0);
    expect(driverSwapCountOf(TEST_CHAMPIONSHIPS, '', 6)).toBe(0);
  });

  it('legge i tempi scritti in molti modi e li riporta sempre a HH:MM:SS.DDD', () => {
    expect(normalizeTimestampText('2:13:20,642')).toBe('02:13:20.642');
    expect(normalizeTimestampText('02:13:20.642')).toBe('02:13:20.642');
    expect(normalizeTimestampText('2.13.20,642')).toBe('02:13:20.642');
    expect(normalizeTimestampText('03.00.00.000')).toBe('03:00:00.000');
    expect(normalizeTimestampText('2:13:20')).toBe('02:13:20.000');
    expect(normalizeTimestampText('13:20.5')).toBe('00:13:20.500');
    expect(normalizeTimestampText('021320642')).toBe('02:13:20.642');
    expect(normalizeTimestampText('021320')).toBe('02:13:20.000');
    // HH.MM.SS,DDD, HHMMSS,DDD e HHMMSS.DDD.
    expect(normalizeTimestampText('02.13.20,642')).toBe('02:13:20.642');
    expect(normalizeTimestampText('021320,642')).toBe('02:13:20.642');
    expect(normalizeTimestampText('021320.642')).toBe('02:13:20.642');
    expect(normalizeTimestampText('021320.6')).toBe('02:13:20.600');
    expect(normalizeTimestampText('026020,642')).toBe('026020,642');
    // Cifre attaccate lette da destra: secondi, minuti, ore.
    expect(normalizeTimestampText('23')).toBe('00:00:23.000');
    expect(normalizeTimestampText('445')).toBe('00:04:45.000');
    expect(normalizeTimestampText('1230')).toBe('00:12:30.000');
    expect(normalizeTimestampText('13000')).toBe('01:30:00.000');
    expect(normalizeTimestampText('23,5')).toBe('00:00:23.500');
    expect(normalizeTimestampText('445.250')).toBe('00:04:45.250');
    expect(normalizeTimestampText('13.20')).toBe('00:13:20.000');
    expect(normalizeTimestampText('75')).toBe('75');
    expect(normalizeTimestampText('1234567')).toBe('1234567');
    expect(parseRaceTimestamp('')).toBeNull();
    // Non interpretabili: restano come sono e vengono segnalati.
    for (const text of ['1:0', '1:60:00', '2:13:20,6421', '1234567', '12345678', '1:2:3:4', 'abc', '100:00:00']) expect(isInvalid(text)).toBe(true);
    expect(normalizeTimestampText('1:60:00')).toBe('1:60:00');
    expect(formatRaceTimestamp(1_542)).toBe('00:00:01.542');
  });

  it('riproduce il calcolo del foglio con margine 2 s e coefficiente 2,5', () => {
    // Stint 2 → 3 del foglio: la #96 riparte con 10:37,804 di distacco dopo essersi fermata con 48:19,942.
    const checks = checkDriverSwap([
      entry(120, '2:11:40.058', '0:15:30.995'),
      entry(54, '2:11:41.526', '0:15:33.964'),
      entry(96, '3:00:00.000', '0:26:08.799'),
      entry(16, '', '0:20:00.000'),
    ]);
    expect(checks[0]).toMatchObject({ pitInDiffMs: 0, pitOutDiffMs: 0, isPenalty: false, penaltyMs: null });
    expect(checks[1]).toMatchObject({ pitInDiffMs: 1468, pitOutDiffMs: 2969, isPenalty: false });
    // 2,5 × (2 899 942 − 637 804 − 2 000) = 5 650 345 ms, arrotondati al secondo per eccesso.
    expect(checks[2]).toMatchObject({ pitInDiffMs: 2_899_942, pitOutDiffMs: 637_804, isPenalty: true, penaltyMs: 5_651_000 });
    expect(checks[3]).toMatchObject({ pitInDiffMs: null, pitOutDiffMs: null, isPenalty: false, penaltyMs: null });
  });

  it('calcola le penalità cambio per cambio e somma per vettura quelle non annullate', () => {
    const saved = withDriverSwapPenalties([
      entry(1, '1:00:00', '0:10:00'),
      entry(2, '1:00:10', '0:10:05'),
      entry(1, '2:00:00', '1:10:00', { swap: 2 }),
      entry(2, '2:00:04', '1:10:00', { swap: 2, isCancelled: true }),
    ]);
    // 10 s al Pit In, 5 al Pit Out, 2 di margine: 2,5 × 3 s = 7,5 → 8 s; nel secondo cambio 2,5 × 2 s, annullata.
    expect(saved.map((row) => row.penaltyMs)).toEqual([null, 8_000, null, 5_000]);
    expect(
      totalDriverSwapPenalties([...checkDriverSwap(saved.filter((row) => row.swap === 1)), ...checkDriverSwap(saved.filter((row) => row.swap === 2))]),
    ).toEqual([{ crewId: 2, penaltyMs: 8_000 }]);
  });

  it('misura i due distacchi dalla vettura ferma per prima: chi riparte davanti al riferimento guadagna al massimo 2 s', () => {
    // #16 si ferma per prima (riferimento) e riparte a 1:00; #317 si ferma 1 s dopo e riparte a 0:50, cioè 10 s davanti.
    const checks = checkDriverSwap([entry(16, '1:00:00.000', '0:01:00.000'), entry(317, '1:00:01.000', '0:00:50.000')]);
    expect(checks[0]).toMatchObject({ pitInDiffMs: 0, pitOutDiffMs: 0, isPenalty: false, penaltyMs: null });
    // Poteva arrivare a −1 s: i 9 s in più × 2,5 = 22,5 → 23 s.
    expect(checks[1]).toMatchObject({ pitInDiffMs: 1_000, pitOutDiffMs: -10_000, isPenalty: true, penaltyMs: 23_000 });
    expect(formatRaceTimestamp(-10_000)).toBe('-00:00:10.000');
    // Guadagno entro il margine: nessuna penalità.
    expect(checkDriverSwap([entry(16, '1:00:00', '0:01:00'), entry(317, '1:00:01', '0:00:59')])[1]).toMatchObject({ pitOutDiffMs: -1_000, isPenalty: false });
    expect(checkDriverSwap([entry(16, '1:00:00', '0:01:00'), entry(317, '1:00:01', '0:00:58.9')])[1]).toMatchObject({ isPenalty: true, penaltyMs: 1_000 });
  });

  it('accetta dal client solo righe valide, nei cambi del campionato e senza ripetizioni', () => {
    const row = { swap: 1, crewId: 4, pitInMs: 10, pitOutMs: null, isCancelled: false, notes: ' Crash ' };
    expect(readDriverSwaps([row], 5)).toEqual([{ ...row, notes: 'Crash' }]);
    expect(readDriverSwaps([{ ...row, swap: 2 }], 1)).toBeNull();
    expect(readDriverSwaps([row, row], 5)).toBeNull();
    expect(readDriverSwaps([{ ...row, pitInMs: -1 }], 5)).toBeNull();
    expect(readDriverSwaps([{ ...row, notes: 'x'.repeat(121) }], 5)).toBeNull();
    expect(readDriverSwaps('no', 5)).toBeNull();
  });
});
