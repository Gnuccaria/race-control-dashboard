import { describe, expect, it } from 'vitest';
import { excelInt, excelMod, excelRound, excelRoundUp } from './excel';

describe('funzioni con semantica Excel', () => {
  it('MOD segue il segno del divisore', () => {
    expect(excelMod(-1, 86_400)).toBe(86_399);
    expect(excelMod(90_000, 86_400)).toBe(3_600);
  });

  it('ROUND arrotonda il .5 allontanandosi da zero', () => {
    expect(excelRound(2.5)).toBe(3);
    expect(excelRound(-2.5)).toBe(-3);
    expect(excelRound(1.005, 2)).toBe(1.01);
  });

  it('ROUNDUP arrotonda sempre per eccesso in valore assoluto', () => {
    expect(excelRoundUp(29.01)).toBe(30);
    expect(excelRoundUp(30)).toBe(30);
    expect(excelRoundUp(-1.2)).toBe(-2);
  });

  it('INT arrotonda verso meno infinito', () => {
    expect(excelInt(53.403)).toBe(53);
    expect(excelInt(-0.2)).toBe(-1);
    expect(excelInt(0.1 * 3 * 10)).toBe(3);
  });
});
