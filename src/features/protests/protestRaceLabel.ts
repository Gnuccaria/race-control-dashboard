import type { Protest } from '@shared/protestRules';
import type { Messages } from '@/i18n/messages';

/** "6 Ore di Monza" oppure "Round 3 – Campionato"; per le proteste mandate prima della scelta della gara, il campionato. */
export const protestRaceLabel = (protest: Pick<Protest, 'race' | 'championship'>, messages: Messages): string | null =>
  protest.race ? (protest.race.name ?? messages.races.raceLabel(protest.race.round, protest.race.championship)) : protest.championship;
