/** "2026-11-20" → "20 nov 2026" nella lingua dell'app (la data non dipende dal fuso orario). */
export function formatIsoDate(isoDate: string, locale: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Istante salvato dal server (ISO, UTC) → data e ora locali, es. "13/11/26, 15:52". */
export function formatTimestamp(isoTimestamp: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(isoTimestamp));
}
