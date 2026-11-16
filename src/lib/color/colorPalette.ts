import { hsvToHex } from './colorConversion';

/** Tinte della tabella colori, in gradi: rossi, arancioni, gialli, verdi, azzurri, blu, viola, rosa. */
const PALETTE_HUES = [0, 20, 35, 50, 75, 120, 160, 185, 205, 225, 265, 300] as const;

/** Righe della tabella: dalle tinte chiare a quelle scure (saturazione e luminosità HSV). */
const PALETTE_SHADES = [
  { saturation: 25, value: 100 },
  { saturation: 50, value: 100 },
  { saturation: 80, value: 100 },
  { saturation: 100, value: 90 },
  { saturation: 100, value: 70 },
  { saturation: 100, value: 45 },
] as const;

const GRAYSCALE_VALUES = [100, 91, 82, 73, 64, 55, 45, 36, 27, 18, 9, 0] as const;

/** Tabella colori: una riga di grigi e sei righe per le dodici tinte, tutte in esadecimale. */
export const COLOR_PALETTE_ROWS: readonly (readonly string[])[] = [
  GRAYSCALE_VALUES.map((value) => hsvToHex({ hue: 0, saturation: 0, value })),
  ...PALETTE_SHADES.map((shade) => PALETTE_HUES.map((hue) => hsvToHex({ hue, ...shade }))),
];
