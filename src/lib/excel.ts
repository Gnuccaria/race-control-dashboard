/**
 * Equivalenti JavaScript delle funzioni Excel usate nei fogli originali.
 * Riprodurne la semantica esatta (non quella di Math.*) garantisce risultati identici.
 */

export const SECONDS_PER_DAY = 86_400;
export const HALF_DAY_SECONDS = SECONDS_PER_DAY / 2;

/** Excel lavora con 15 cifre significative: eliminiamo il rumore floating point. */
const toExcelPrecision = (value: number): number => Number(value.toPrecision(15));

/** MOD(n; d): il risultato ha sempre il segno del divisore. */
export function excelMod(dividend: number, divisor: number): number {
  return dividend - divisor * Math.floor(dividend / divisor);
}

/** ROUND(x; n): sul .5 arrotonda allontanandosi da zero (Math.round no). */
export function excelRound(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return (Math.sign(value) * Math.round(toExcelPrecision(Math.abs(value) * factor))) / factor;
}

/** ROUNDUP(x; n): arrotonda sempre allontanandosi da zero. */
export function excelRoundUp(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return (Math.sign(value) * Math.ceil(toExcelPrecision(Math.abs(value) * factor))) / factor;
}

/** INT(x): arrotonda per difetto verso meno infinito (anche per i negativi). */
export function excelInt(value: number): number {
  return Math.floor(toExcelPrecision(value));
}

/** Riporta un numero di secondi nell'intervallo di un giorno [0, 86400). */
export const wrapToDay = (seconds: number): number => excelMod(seconds, SECONDS_PER_DAY);
