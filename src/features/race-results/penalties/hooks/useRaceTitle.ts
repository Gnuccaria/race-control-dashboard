import type { SavedRace } from '@shared/raceRules';
import { useI18n } from '@/i18n/useI18n';

/** "6 Ore di Monza" oppure "Round 3 · Campionato", come nel dettaglio della gara; vuoto finché la gara non è letta. */
export function useRaceTitle(race: SavedRace | null): string {
  const { messages } = useI18n();
  if (!race) return '';
  return race.name ?? messages.races.raceLabel(race.round, race.championship);
}
