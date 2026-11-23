import { describe, expect, it } from 'vitest';
import { parseCsvNumber } from '../src/import/csv';

describe('numeri nei CSV', () => {
  it('legge i numeri scritti all\'italiana', () => {
    expect(parseCsvNumber('1.250')).toBe(1250);
    expect(parseCsvNumber('95,5')).toBe(95.5);
    expect(parseCsvNumber(' 20% ')).toBe(20);
    expect(parseCsvNumber('')).toBeNull();
    expect(Number.isNaN(parseCsvNumber('tanti'))).toBe(true);
  });
});
