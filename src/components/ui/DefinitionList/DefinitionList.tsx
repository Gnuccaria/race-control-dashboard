import type { ReactNode } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './DefinitionList.module.css';

const LAYOUT_CLASS_NAMES = {
  columns: styles.layoutColumns,
  rows: styles.layoutRows,
};

export interface DefinitionItem {
  readonly term: string;
  readonly description: ReactNode;
}

interface DefinitionListProps {
  readonly items: readonly DefinitionItem[];
  /** columns: termini sopra i valori, affiancati. rows: un termine per riga con il valore a destra. */
  readonly layout?: 'columns' | 'rows';
  readonly className?: string;
}

export function DefinitionList({ items, layout = 'rows', className }: DefinitionListProps) {
  return (
    <dl className={joinClassNames(styles.definitionList, LAYOUT_CLASS_NAMES[layout], className)}>
      {items.map(({ term, description }) => (
        <div key={term} className={styles.definitionItem}>
          <dt className={styles.definitionTerm}>{term}</dt>
          <dd className={styles.definitionDescription}>{description}</dd>
        </div>
      ))}
    </dl>
  );
}
