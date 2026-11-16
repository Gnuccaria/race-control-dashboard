import type { ComponentProps } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './Select.module.css';

export interface SelectOption<OptionValue extends string> {
  readonly value: OptionValue;
  readonly label: string;
}

interface SelectProps<OptionValue extends string> extends Omit<ComponentProps<'select'>, 'value' | 'onChange'> {
  /** Stringa vuota = nessuna scelta (mostra il segnaposto). */
  readonly value: OptionValue | '';
  readonly options: readonly SelectOption<OptionValue>[];
  readonly onValueChange: (value: OptionValue) => void;
  /** Testo mostrato finché non si sceglie un'opzione; non è selezionabile. */
  readonly placeholderLabel?: string;
}

/** Menu a tendina nativo e tipizzato: restituisce solo valori presenti tra le opzioni. */
export function Select<OptionValue extends string>({
  value,
  options,
  onValueChange,
  placeholderLabel,
  className,
  ...selectProps
}: SelectProps<OptionValue>) {
  return (
    <span className={joinClassNames(styles.selectFrame, className)}>
      <select
        className={styles.select}
        value={value}
        onChange={(changeEvent) => {
          const selectedOption = options.find((option) => option.value === changeEvent.currentTarget.value);
          if (selectedOption) onValueChange(selectedOption.value);
        }}
        {...selectProps}
      >
        {placeholderLabel !== undefined && (
          <option value="" disabled>
            {placeholderLabel}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className={styles.selectChevron}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </span>
  );
}
