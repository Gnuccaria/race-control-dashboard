/**
 * Converte il testo di un campo numerico. Come in Excel un campo vuoto vale 0;
 * accetta anche la virgola decimale. Restituisce null se il testo non è un numero.
 */
export function parseLocaleNumber(rawValue: string): number | null {
  const normalizedValue = rawValue.trim().replace(',', '.');
  const parsedValue = normalizedValue === '' ? 0 : Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/** Parser che accetta solo numeri maggiori o uguali alla soglia. */
export const parseNumberAtLeast =
  (minimum: number) =>
  (rawValue: string): number | null => {
    const parsedValue = parseLocaleNumber(rawValue);
    return parsedValue !== null && parsedValue >= minimum ? parsedValue : null;
  };

/** Parser che accetta solo numeri strettamente positivi. */
export function parsePositiveNumber(rawValue: string): number | null {
  const parsedValue = parseLocaleNumber(rawValue);
  return parsedValue !== null && parsedValue > 0 ? parsedValue : null;
}
