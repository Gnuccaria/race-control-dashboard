import type { ReactNode } from 'react';
import styles from './FieldGrid.module.css';

interface FieldGridProps {
  readonly children: ReactNode;
}

/** Affianca i campi quando c'è spazio e li impila sugli schermi stretti. */
export function FieldGrid({ children }: FieldGridProps) {
  return <div className={styles.fieldGrid}>{children}</div>;
}
