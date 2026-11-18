import { stintStartTimes } from '@shared/championshipRules';
import { TimeField } from '@/components/form/TimeField/TimeField';
import { useI18n } from '@/i18n/useI18n';
import { formatClockTime } from '@/i18n/hourCycle';
import type { ChampionshipDraftState } from '../../hooks/useChampionshipDraft';
import styles from './StintScheduleField.module.css';

interface StintScheduleFieldProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Gestione stint": per ogni durata della scheda Generale l'orario di partenza (obbligatorio) e, calcolato da
 * quello, l'orario di inizio di ogni stint. La partenza è proposta alle gare nuove di quella durata.
 */
export function StintScheduleField({ draft, isReadOnly }: StintScheduleFieldProps) {
  const { locale, messages } = useI18n();
  const texts = messages.championships.stints;
  const rows = draft.scheduledRows;

  if (rows.length === 0) return <p className={styles.hint}>{texts.empty}</p>;

  return (
    <div className={styles.schedule}>
      {!isReadOnly && <p className={styles.hint}>{texts.hint}</p>}
      {rows.map((row) => {
        const hours = Number(row.hours);
        const stintMinutes = Number(row.stintMinutes);
        const startTimes = stintStartTimes({ hours, stintMinutes, startTime: row.startTime });
        return (
          <section key={row.rowId} className={styles.duration} aria-label={texts.durationTitle(hours, stintMinutes)}>
            <h3 className={styles.title}>{texts.durationTitle(hours, stintMinutes)}</h3>
            <div className={styles.startTime}>
              <TimeField
                label={texts.startTime}
                hint={isReadOnly ? undefined : texts.startTimeHint}
                isReadOnly={isReadOnly}
                field={{
                  value: row.startTime,
                  onValueChange: (startTime) => draft.changeStartTime(row.rowId, startTime),
                  errorMessage: !isReadOnly && row.startTime === '' ? texts.missingStartTime : undefined,
                }}
              />
            </div>
            <ol className={styles.stints} aria-label={texts.stintsOf(hours)}>
              {Array.from({ length: (hours * 60) / stintMinutes }, (_unused, index) => (
                <li key={index} className={styles.stint}>
                  <span className={styles.stintName}>{texts.stint(index + 1)}</span>
                  <span className={styles.stintTime}>{startTimes[index] ? formatClockTime(startTimes[index], locale) : '--'}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
