import type { ComponentProps } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './Textarea.module.css';

interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> {
  readonly value: string;
  readonly onValueChange: (nextValue: string) => void;
  readonly isInvalid?: boolean;
}

/** Testo libero su più righe, con lo stesso aspetto di Input; in sola lettura non riceve clic né focus col Tab. */
export function Textarea({ value, onValueChange, isInvalid = false, className, readOnly, tabIndex, onFocus, rows = 5, ...textareaProps }: TextareaProps) {
  return (
    <textarea
      className={joinClassNames(styles.textarea, className)}
      value={value}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : tabIndex}
      // In sola lettura il focus (es. dal clic sull'etichetta del campo) si toglie subito: nessun cursore.
      onFocus={readOnly ? (focusEvent) => focusEvent.currentTarget.blur() : onFocus}
      onChange={(changeEvent) => {
        onValueChange(changeEvent.currentTarget.value);
      }}
      {...textareaProps}
    />
  );
}
