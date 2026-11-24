import { QUALIFYING_ADVANCE_HOURS, QUALIFYING_DURATION_MINUTES, QUALIFYING_PROTEST_HOURS, RACE_PROTEST_HOURS } from '@shared/protestTimingRules';
import { FormField } from '@/components/form/FormField/FormField';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import type { ChampionshipDraftState, ProtestTimesValues } from '../../hooks/useChampionshipDraft';
import styles from '../ChampionshipFields/ChampionshipFields.module.css';

interface ProtestTimesFieldProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly: boolean;
}

/**
 * Scheda Generale: con quanto anticipo sulla gara si tengono le qualifiche e quanto durano, e fino a quando si possono
 * mandare le proteste dopo le qualifiche e dopo la gara (menu con valori fissi). Le due finestre non si sovrappongono:
 * le qualifiche con le loro proteste devono finire prima della partenza della gara.
 */
export function ProtestTimesField({ draft, isReadOnly }: ProtestTimesFieldProps) {
  const { messages } = useI18n();
  const texts = messages.championships.protestTimes;
  const values = draft.values.protestTimes;
  const select = (field: keyof ProtestTimesValues, label: string, hint: string, options: readonly number[], formatOption: (value: number) => string, errorMessage?: string) => (
    <FormField label={label} hint={isReadOnly ? undefined : hint} errorMessage={errorMessage}>
      {({ isInvalid, ...controlProps }) => (
        <Select
          id={controlProps.id}
          aria-describedby={controlProps['aria-describedby']}
          aria-invalid={isInvalid || undefined}
          disabled={isReadOnly}
          placeholderLabel={texts.choose}
          value={values[field]}
          options={options.map((option) => ({ value: String(option), label: formatOption(option) }))}
          onValueChange={(value) => draft.changeProtestTime(field, value)}
        />
      )}
    </FormField>
  );

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{texts.legend}</legend>
      {!isReadOnly && <p className={styles.hint}>{texts.hint}</p>}
      <div className={styles.protestTimes}>
        {select('advanceHours', texts.advance, texts.advanceHint, QUALIFYING_ADVANCE_HOURS, texts.hours)}
        {select('qualifyingMinutes', texts.qualifyingDuration, texts.qualifyingDurationHint, QUALIFYING_DURATION_MINUTES, texts.minutes)}
        {select(
          'qualifyingProtestHours',
          texts.qualifyingProtests,
          texts.qualifyingProtestsHint,
          QUALIFYING_PROTEST_HOURS,
          texts.hours,
          !isReadOnly && draft.hasProtestTimesOverlap ? texts.overlap : undefined,
        )}
        {select('raceProtestHours', texts.raceProtests, texts.raceProtestsHint, RACE_PROTEST_HOURS, texts.hours)}
      </div>
    </fieldset>
  );
}
