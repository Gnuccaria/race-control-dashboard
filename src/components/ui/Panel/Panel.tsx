import { type ReactNode, useId } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/** Sezione con titolo: piatta, separata dallo spazio e da un filo, senza ombre. */
export function Panel({ title, description, children }: PanelProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2 id={titleId} className={styles.panelTitle}>
          {title}
        </h2>
        {description && <p className={styles.panelDescription}>{description}</p>}
      </header>
      <div className={styles.panelContent}>{children}</div>
    </section>
  );
}
