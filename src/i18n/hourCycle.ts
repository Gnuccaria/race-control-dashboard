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

/** Un orario "HH:MM" come si legge nella lingua: "21:05", in inglese "9:05 PM". */
export function formatClockTime(time: string, locale: string): string {
  if (!usesTwelveHourClock(locale)) return time;
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const periods = dayPeriodLabels(locale);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? periods.am : periods.pm}`;
}
