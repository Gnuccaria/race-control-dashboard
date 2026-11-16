/**
 * Orologio della lingua: 24 ore dove si usa (italiano, francese, tedesco…), 12 ore con AM/PM dove si usa
 * (inglese degli Stati Uniti, la variante predefinita di "en"). Lo decide Intl, come il resto della formattazione.
 */
export function usesTwelveHourClock(locale: string): boolean {
  const { hourCycle, hour12 } = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions();
  return hourCycle === undefined ? hour12 === true : hourCycle === 'h11' || hourCycle === 'h12';
}

/** "AM"/"PM" nella lingua (es. "AM"/"PM" in inglese). */
export function dayPeriodLabels(locale: string): { readonly am: string; readonly pm: string } {
  const format = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  const periodAt = (hour: number) =>
    format.formatToParts(new Date(Date.UTC(2026, 0, 1, hour))).find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM');
  return { am: periodAt(9), pm: periodAt(21) };
}
