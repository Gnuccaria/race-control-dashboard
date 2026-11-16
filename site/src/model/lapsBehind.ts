/** Giri in meno rispetto al primo della classifica; null se non si può dire (giri mancanti o nessuno di meno). */
export function computeLapsBehind(leaderLaps: number | null, laps: number | null): number | null {
  if (leaderLaps === null || laps === null) return null;
  const lapsBehind = leaderLaps - laps;
  return lapsBehind > 0 ? lapsBehind : null;
}
