/**
 * Orologio della lingua dell'app: 12 ore con AM/PM solo in inglese (scelto o predefinito perché è la lingua del
 * sistema), 24 ore in tutte le altre (italiano, francese, tedesco). Vale per tutti gli orari che si inseriscono.
 */
export function usesTwelveHourClock(locale: string): boolean {
  return locale === 'en' || locale.startsWith('en-');
}

/** "AM"/"PM" nella lingua (es. "AM"/"PM" in inglese). */
export function dayPeriodLabels(locale: string): { readonly am: string; readonly pm: string } {
  const format = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  const periodAt = (hour: number) =>
    format.formatToParts(new Date(Date.UTC(2026, 0, 1, hour))).find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM');
  return { am: periodAt(9), pm: periodAt(21) };
}
