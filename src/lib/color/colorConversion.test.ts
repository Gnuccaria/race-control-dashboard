import { describe, expect, it } from 'vitest';
import { clampHsv, hexToHsv, hsvToHex, parseHexColor, prefersDarkText } from './colorConversion';
import { COLOR_PALETTE_ROWS } from './colorPalette';

describe('conversioni colore', () => {
  it('riconosce gli esadecimali a 6 cifre, con o senza #', () => {
    expect(parseHexColor('#e10600')).toBe('#E10600');
    expect(parseHexColor(' 00A3E0 ')).toBe('#00A3E0');
    expect(parseHexColor('#FFF')).toBeNull();
    expect(parseHexColor('#GG0000')).toBeNull();
  });

  it('converte da esadecimale a HSV', () => {
    expect(hexToHsv('#FF0000')).toEqual({ hue: 0, saturation: 100, value: 100 });
    expect(hexToHsv('#00FF00')).toEqual({ hue: 120, saturation: 100, value: 100 });
    expect(hexToHsv('#0000FF')).toEqual({ hue: 240, saturation: 100, value: 100 });
    expect(hexToHsv('#FFFFFF')).toEqual({ hue: 0, saturation: 0, value: 100 });
    expect(hexToHsv('#000000')).toEqual({ hue: 0, saturation: 0, value: 0 });
    expect(hexToHsv('#FF00FF')).toEqual({ hue: 300, saturation: 100, value: 100 });
  });

  it('converte da HSV a esadecimale', () => {
    expect(hsvToHex({ hue: 0, saturation: 100, value: 100 })).toBe('#FF0000');
    expect(hsvToHex({ hue: 210, saturation: 100, value: 50 })).toBe('#004080');
    expect(hsvToHex({ hue: 360, saturation: 100, value: 100 })).toBe('#FF0000');
    expect(hsvToHex({ hue: 0, saturation: 0, value: 50 })).toBe('#808080');
  });

  it('andata e ritorno restano vicine al colore di partenza', () => {
    for (const hexColor of ['#E10600', '#00A3E0', '#FFB800', '#2E7D32', '#6A1B9A']) {
      const roundTrip = hsvToHex(hexToHsv(hexColor));
      const channelDifference = (offset: number) =>
        Math.abs(Number.parseInt(hexColor.slice(offset, offset + 2), 16) - Number.parseInt(roundTrip.slice(offset, offset + 2), 16));
      expect(Math.max(channelDifference(1), channelDifference(3), channelDifference(5))).toBeLessThanOrEqual(3);
    }
  });

  it('riporta nei limiti i valori digitati', () => {
    expect(clampHsv({ hue: 400, saturation: -5, value: 50.6 })).toEqual({ hue: 360, saturation: 0, value: 51 });
  });

  it('sceglie il testo leggibile sopra un colore', () => {
    expect(prefersDarkText('#FFFFFF')).toBe(true);
    expect(prefersDarkText('#FFB800')).toBe(true);
    expect(prefersDarkText('#002B5C')).toBe(false);
  });

  it('la tabella colori ha 7 righe da 12 colori validi, senza doppioni', () => {
    const allColors = COLOR_PALETTE_ROWS.flat();
    expect(COLOR_PALETTE_ROWS).toHaveLength(7);
    expect(COLOR_PALETTE_ROWS.every((row) => row.length === 12)).toBe(true);
    expect(allColors.every((color) => parseHexColor(color) === color)).toBe(true);
    expect(new Set(allColors).size).toBe(allColors.length);
  });
});
