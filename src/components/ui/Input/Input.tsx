import type { ComponentProps } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './Input.module.css';

interface InputProps extends Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  readonly type: 'number' | 'time' | 'text' | 'date';
  readonly value: string;
  readonly onValueChange: (nextValue: string) => void;
  readonly isInvalid?: boolean;
  /** Senza bordo: per input inseriti in un contenitore che ha già il suo bordo. */
  readonly isBare?: boolean;
}

/**
 * Campo controllato (numero, orario o testo). Per i numeri apre il tastierino decimale su mobile.
 * In sola lettura non riceve clic né focus col Tab: vale per tutti i campi dell'app.
 */
export function Input({
  type,
  value,
  onValueChange,
  isInvalid = false,
  isBare = false,
  className,
  readOnly,
  tabIndex,
  onFocus,
  ...inputProps
}: InputProps) {
  return (
    <input
      type={type}
      inputMode={type === 'number' ? 'decimal' : undefined}
      autoComplete="off"
      className={joinClassNames(styles.input, isBare && styles.bareInput, className)}
      value={value}
      aria-invalid={isInvalid || undefined}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : tabIndex}
      // In sola lettura il focus (es. dal clic sull'etichetta del campo) si toglie subito: nessun cursore.
      onFocus={readOnly ? (focusEvent) => focusEvent.currentTarget.blur() : onFocus}
      onChange={(changeEvent) => {
        onValueChange(changeEvent.currentTarget.value);
      }}
      {...inputProps}
    />
  );
}
