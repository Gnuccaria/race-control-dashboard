/**
 * Conversioni tra esadecimale (#RRGGBB) e HSV, usate dal selettore colore.
 * H in gradi 0–360, S e V in percentuale 0–100, tutti interi come nei campi del popup.
 */

export interface HsvColor {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
}

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{6})$/i;

/** "#e10600" o "E10600" → "#E10600"; null se non è un esadecimale a 6 cifre. */
export function parseHexColor(rawHex: string): string | null {
  const match = HEX_COLOR_PATTERN.exec(rawHex.trim());
  return match?.[1] ? `#${match[1].toUpperCase()}` : null;
}

export function hexToHsv(hexColor: string): HsvColor {
  const channelValue = (offset: number) => Number.parseInt(hexColor.slice(offset, offset + 2), 16) / 255;
  const [red, green, blue] = [channelValue(1), channelValue(3), channelValue(5)];
  const maximum = Math.max(red, green, blue);
  const chroma = maximum - Math.min(red, green, blue);

  let hue = 0;
  if (chroma > 0) {
    if (maximum === red) hue = ((green - blue) / chroma) % 6;
    else if (maximum === green) hue = (blue - red) / chroma + 2;
    else hue = (red - green) / chroma + 4;
  }

  return {
    hue: Math.round((hue * 60 + 360) % 360),
    saturation: Math.round(maximum === 0 ? 0 : (chroma / maximum) * 100),
    value: Math.round(maximum * 100),
  };
}

export function hsvToHex({ hue, saturation, value }: HsvColor): string {
  const normalizedSaturation = saturation / 100;
  const normalizedValue = value / 100;
  const channel = (offset: number) => {
    const position = (offset + hue / 60) % 6;
    const channelValue =
      normalizedValue - normalizedValue * normalizedSaturation * Math.max(0, Math.min(position, 4 - position, 1));
    return Math.round(channelValue * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`.toUpperCase();
}

const clampToRange = (number: number, maximum: number) => Math.min(Math.max(Math.round(number), 0), maximum);

/** Riporta i valori digitati nei limiti (H 0–360, S e V 0–100). */
export const clampHsv = ({ hue, saturation, value }: HsvColor): HsvColor => ({
  hue: clampToRange(hue, 360),
  saturation: clampToRange(saturation, 100),
  value: clampToRange(value, 100),
});

/** Testo scuro o chiaro sopra un colore, per restare leggibile (luminanza relativa WCAG). */
export function prefersDarkText(hexColor: string): boolean {
  const linearChannel = (offset: number) => {
    const channelValue = Number.parseInt(hexColor.slice(offset, offset + 2), 16) / 255;
    return channelValue <= 0.04045 ? channelValue / 12.92 : ((channelValue + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linearChannel(1) + 0.7152 * linearChannel(3) + 0.0722 * linearChannel(5);
  return luminance > 0.4;
}
