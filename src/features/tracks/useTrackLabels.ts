import type { Track } from '@shared/raceRules';
import { useI18n } from '@/i18n/useI18n';
import { formatTrackChoice, NO_CONTINENT, translateTrackTerm } from './model/trackSelection';

/** Nomi di continenti, configurazioni e tracciati nella lingua dell'app (dal server arrivano in inglese). */
export function useTrackLabels() {
  const { messages } = useI18n();
  const { continents, configurations } = messages.trackTerms;
  const labelTexts = { configurations, reversedSuffix: messages.tracks.reversedSuffix };

  return {
    continentLabel: (continent: string) => (continent === NO_CONTINENT ? messages.tracks.noContinent : translateTrackTerm(continents, continent)),
    configurationLabel: (configuration: string | null) =>
      configuration === null ? messages.tracks.singleConfiguration : translateTrackTerm(configurations, configuration),
    trackLabel: (track: Pick<Track, 'name' | 'configuration'>, isReversed: boolean) => formatTrackChoice(track, isReversed, labelTexts),
  };
}
