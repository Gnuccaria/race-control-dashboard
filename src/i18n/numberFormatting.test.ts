import { describe, expect, it } from 'vitest';
import { getNumberFormatters } from './numberFormatting';

describe('formattazione dei numeri per lingua', () => {
  it('usa il separatore decimale di ogni lingua', () => {
    expect(getNumberFormatters('it').formatDecimal(190.403)).toBe('190,403');
    expect(getNumberFormatters('en').formatDecimal(190.403)).toBe('190.403');
    expect(getNumberFormatters('de').formatDecimal(7.5)).toBe('7,5');
  });

  it('mostra il segno esplicito nelle differenze', () => {
    const { formatSignedDecimal } = getNumberFormatters('it');
    expect(formatSignedDecimal(10)).toBe('+10');
    expect(formatSignedDecimal(-5.5)).toBe('−5,5');
    expect(formatSignedDecimal(0)).toBe('0');
  });
});
