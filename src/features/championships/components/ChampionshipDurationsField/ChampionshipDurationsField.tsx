import { driverSwapCountFor, stintCount } from '@shared/championshipRules';
import { Button } from '@/components/ui/Button/Button';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Input } from '@/components/ui/Input/Input';
import { useI18n } from '@/i18n/useI18n';
import { type ChampionshipDraftState, findRowIssue } from '../../hooks/useChampionshipDraft';
import styles from '../ChampionshipFields/ChampionshipFields.module.css';
import { RemoveIcon } from '../RemoveIcon';

interface ChampionshipDurationsFieldProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly: boolean;
}

/**
 * Durate di gara: da una a tre righe con le ore e i minuti dello stint; accanto, quanti stint e cambi pilota
 * ne vengono. La X toglie una riga (resta sempre almeno una durata da compilare).
 */
export function ChampionshipDurationsField({ draft, isReadOnly }: ChampionshipDurationsFieldProps) {
  const { messages } = useI18n();
  const texts = messages.championships;
  const rows = draft.values.durations;

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{texts.durations}</legend>
      {!isReadOnly && <p className={styles.hint}>{texts.durationsHint}</p>}
      <ul className={styles.list}>
        {rows.map((row, index) => {
          const position = index + 1;
          const issue = isReadOnly ? null : findRowIssue(row, rows);
          const isComplete = row.hours !== '' && row.stintMinutes !== '' && findRowIssue(row, rows) === null;
          // "Manca un valore" solo per il campo vuoto; gli altri problemi sul campo che li causa.
          const isHoursInvalid = issue === 'hours' || issue === 'repeated' || (issue === 'incomplete' && row.hours === '');
          const isStintInvalid = issue === 'stint' || issue === 'not-divisor' || issue === 'too-many-stints' || (issue === 'incomplete' && row.stintMinutes === '');
          const duration = { hours: Number(row.hours), stintMinutes: Number(row.stintMinutes) };
          return (
            <li key={row.rowId} className={styles.durationRow}>
              <label className={styles.inlineField}>
                <span>{texts.hours}</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label={texts.hoursOf(position)}
                  readOnly={isReadOnly}
                  isInvalid={isHoursInvalid}
                  value={row.hours}
                  onValueChange={(value) => draft.changeHours(row.rowId, value)}
                />
              </label>
              <label className={styles.inlineField}>
                <span>{texts.stintMinutes}</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label={texts.stintOf(position)}
                  readOnly={isReadOnly}
                  isInvalid={isStintInvalid}
                  value={row.stintMinutes}
                  onValueChange={(value) => draft.changeStintMinutes(row.rowId, value)}
                />
              </label>
              <span className={issue ? styles.rowError : styles.rowSummary} aria-live="polite">
                {issue ? texts.durationIssues[issue] : isComplete ? texts.durationSummary(stintCount(duration), driverSwapCountFor(duration)) : ''}
              </span>
              {!isReadOnly && rows.length > 1 && (
                <IconButton accessibleLabel={texts.removeDuration(position)} title={texts.removeDuration(position)} onClick={() => draft.removeDuration(row.rowId)}>
                  <RemoveIcon />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
      {!isReadOnly && draft.canAddDuration && (
        <Button variant="secondary" className={styles.addButton} onClick={draft.addDuration}>
          {texts.addDuration}
        </Button>
      )}
    </fieldset>
  );
}
