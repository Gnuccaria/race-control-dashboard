import type { Track } from '@shared/raceRules';
import { trackLengthUnits } from '@shared/trackRules';
import { useI18n } from '@/i18n/useI18n';
import { formatTrackChoice, NO_COUNTRY, translateTrackTerm } from './model/trackSelection';

/** Nazioni, configurazioni, tracciati e lunghezze nella lingua dell'app (dal server arrivano in inglese e in metri). */
export function useTrackLabels() {
  const { messages, locale } = useI18n();
  const { configurations } = messages.trackTerms;
  const labelTexts = { configurations, reversedSuffix: messages.tracks.reversedSuffix };
  const countryNames = new Intl.DisplayNames([locale], { type: 'region' });
  const kilometers = new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const miles = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    /** "IT" → "Italia"; i codici sconosciuti restano com'erano. */
    countryLabel: (country: string) => {
      if (country === NO_COUNTRY) return messages.tracks.noCountry;
      try {
        return countryNames.of(country) ?? country;
      } catch {
        return country;
      }
    },
    configurationLabel: (configuration: string | null) =>
      configuration === null ? messages.tracks.singleConfiguration : translateTrackTerm(configurations, configuration),
    trackLabel: (track: Pick<Track, 'name' | 'configuration'>, isReversed: boolean) => formatTrackChoice(track, isReversed, labelTexts),
    /** "5,809 km (3,61 mi)". */
    lengthLabel: (lengthMeters: number) => {
      const units = trackLengthUnits(lengthMeters);
      return messages.tracks.lengthValue(kilometers.format(units.km), miles.format(units.miles));
    },
  };
}
