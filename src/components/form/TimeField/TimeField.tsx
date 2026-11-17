import { Select } from '@/components/ui/Select/Select';
import { dayPeriodLabels, usesTwelveHourClock } from '@/i18n/hourCycle';
import { useI18n } from '@/i18n/useI18n';
import type { FieldBinding } from '../fieldBinding';
import { FormField } from '../FormField/FormField';
import styles from './TimeField.module.css';

interface TimeFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly field: FieldBinding;
  /** Sola lettura: i menu si vedono ma non si aprono. */
  readonly isReadOnly?: boolean;
}

type DayPeriod = 'am' | 'pm';

const twoDigits = (value: number) => String(value).padStart(2, '0');
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_unused, minute) => ({ value: twoDigits(minute), label: twoDigits(minute) }));
const HOUR_24_OPTIONS = Array.from({ length: 24 }, (_unused, hour) => ({ value: String(hour), label: twoDigits(hour) }));
/** 12, 1, 2 … 11, come sugli orologi a 12 ore. */
const HOUR_12_OPTIONS = [12, ...Array.from({ length: 11 }, (_unused, index) => index + 1)].map((hour) => ({ value: String(hour), label: String(hour) }));

/** "21:05" → { hour: 21, minute: 5 }; null se vuoto o non valido. */
function parseTimeValue(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/**
 * Orario (valore sempre "HH:MM" a 24 ore) con un menu per le ore e uno per i minuti, più AM/PM nelle lingue che
 * usano l'orologio a 12 ore (solo l'inglese: usesTwelveHourClock). Non usa <input type="time">, che segue la lingua del sistema e non quella
 * scelta nell'app. Scegliendo una parte, le altre ancora vuote prendono il valore iniziale (ore 0, minuti 00).
 */
export function TimeField({ label, hint, field, isReadOnly = false }: TimeFieldProps) {
  const { locale, messages } = useI18n();
  const texts = messages.common.timeField;
  const isTwelveHour = usesTwelveHourClock(locale);
  const time = parseTimeValue(field.value);
  const hour = time?.hour ?? 0;
  const minute = time?.minute ?? 0;
  const period: DayPeriod = hour < 12 ? 'am' : 'pm';
  const periodLabels = dayPeriodLabels(locale);

  const change = (nextHour: number, nextMinute: number) => {
    field.onValueChange(`${twoDigits(nextHour)}:${twoDigits(nextMinute)}`);
  };
  const toTwentyFourHour = (hourOnClock: number, nextPeriod: DayPeriod) => (hourOnClock % 12) + (nextPeriod === 'pm' ? 12 : 0);

  return (
    <FormField label={label} hint={hint} errorMessage={field.errorMessage}>
      {({ isInvalid, id, 'aria-describedby': describedBy }) => (
        <div className={styles.timeField} role="group" aria-label={label} aria-describedby={describedBy}>
          <Select
            id={id}
            className={styles.part}
            aria-label={`${label}: ${texts.hours}`}
            aria-invalid={isInvalid || undefined}
            disabled={isReadOnly}
            placeholderLabel="--"
            value={time ? String(isTwelveHour ? hour % 12 || 12 : hour) : ''}
            options={isTwelveHour ? HOUR_12_OPTIONS : HOUR_24_OPTIONS}
            onValueChange={(selected) => {
              change(isTwelveHour ? toTwentyFourHour(Number(selected), period) : Number(selected), minute);
            }}
          />
          <span className={styles.separator} aria-hidden="true">
            :
          </span>
          <Select
            className={styles.part}
            aria-label={`${label}: ${texts.minutes}`}
            aria-invalid={isInvalid || undefined}
            disabled={isReadOnly}
            placeholderLabel="--"
            value={time ? twoDigits(minute) : ''}
            options={MINUTE_OPTIONS}
            onValueChange={(selected) => {
              change(hour, Number(selected));
            }}
          />
          {isTwelveHour && (
            <Select<DayPeriod>
              className={styles.part}
              aria-label={`${label}: ${texts.dayPeriod}`}
              disabled={isReadOnly}
              placeholderLabel="--"
              value={time ? period : ''}
              options={[
                { value: 'am', label: periodLabels.am },
                { value: 'pm', label: periodLabels.pm },
              ]}
              onValueChange={(selected) => {
                change(toTwentyFourHour(hour, selected), minute);
              }}
            />
          )}
        </div>
      )}
    </FormField>
  );
}
