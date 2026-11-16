import { type ReactNode, useId } from 'react';
import type { FieldControlProps } from '../fieldBinding';
import { FieldMessage } from '../FieldMessage/FieldMessage';
import styles from './FormField.module.css';

interface FormFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly errorMessage?: string | undefined;
  /** Riceve id e descrizioni da applicare al controllo, così etichetta e messaggi restano collegati. */
  readonly children: (controlProps: FieldControlProps) => ReactNode;
}

/** Etichetta + controllo + suggerimento/errore, con tutti i collegamenti ARIA. */
export function FormField({ label, hint, errorMessage, children }: FormFieldProps) {
  const controlId = useId();
  const messageId = `${controlId}-message`;
  const message = errorMessage ?? hint;

  return (
    <div className={styles.formField}>
      <label htmlFor={controlId} className={styles.fieldLabel}>
        {label}
      </label>
      {children({
        id: controlId,
        'aria-describedby': message ? messageId : undefined,
        isInvalid: errorMessage !== undefined,
      })}
      {message && (
        <FieldMessage id={messageId} isError={errorMessage !== undefined}>
          {message}
        </FieldMessage>
      )}
    </div>
  );
}
