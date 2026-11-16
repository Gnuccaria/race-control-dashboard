export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/** Fasce orarie dei saluti: mattina 5–13, pomeriggio 13–18, sera 18–23, notte 23–5. */
export function getDayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 13) return 'morning';
  if (hour >= 13 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}
