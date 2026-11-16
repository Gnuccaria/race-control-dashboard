import { joinClassNames } from '@/lib/joinClassNames';
import styles from './FieldMessage.module.css';

interface FieldMessageProps {
  readonly id: string;
  readonly isError: boolean;
  readonly children: string;
}

/** Suggerimento o errore sotto un campo. */
export function FieldMessage({ id, isError, children }: FieldMessageProps) {
  return (
    <p id={id} className={joinClassNames(styles.fieldMessage, isError && styles.errorMessage)}>
      {children}
    </p>
  );
}
