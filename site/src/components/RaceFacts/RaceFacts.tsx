import type { RaceSummary } from '@shared/raceRules';
import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { useTrackLabels } from '@/features/tracks/useTrackLabels';
import { useI18n } from '@/i18n/useI18n';
import { formatIsoDate } from '@/lib/dateFormatting';
import styles from './RaceFacts.module.css';

/** I dati principali della gara in una riga, come nelle schede dei risultati: data, tracciato, durata, giri. */
export function RaceFacts({ race }: { readonly race: RaceSummary }) {
  const { messages, locale } = useI18n();
  const { trackLabel } = useTrackLabels();
  const factTexts = messages.site.facts;
  const notSet = <span className={styles.notSet}>{factTexts.notSet}</span>;

  return (
    <DefinitionList
      layout="columns"
      className={styles.raceFacts}
      items={[
        { term: factTexts.date, description: formatIsoDate(race.raceDate, locale) },
        {
          term: factTexts.track,
          description:
            race.trackName === null ? notSet : trackLabel({ name: race.trackName, configuration: race.trackConfiguration }, race.isTrackReversed),
        },
        { term: factTexts.duration, description: race.duration ? (messages.races.form.durations[race.duration] ?? race.duration) : notSet },
        { term: factTexts.totalLaps, description: race.totalLaps ?? notSet },
      ]}
    />
  );
}
