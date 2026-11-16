import type { ReactNode } from 'react';
import { ToolPageHeader } from '../ToolPageHeader/ToolPageHeader';
import styles from './ToolLayout.module.css';

interface ToolLayoutProps {
  readonly toolInfo: { readonly name: string; readonly description: string };
  /** Nome accessibile del form con i dati da inserire. */
  readonly inputsLabel: string;
  /** Pannelli con i campi, a sinistra su desktop. */
  readonly inputs: ReactNode;
  /** Risultati, a destra su desktop e sempre visibili mentre si scorre. */
  readonly results: ReactNode;
  readonly guide?: ReactNode;
  /** Risultati fermi mentre si scorre (default); false quando la colonna è più alta dello schermo. */
  readonly isResultsSticky?: boolean;
}

/** Struttura comune delle pagine strumento: intestazione, dati, risultati e guida. */
export function ToolLayout({ toolInfo, inputsLabel, inputs, results, guide, isResultsSticky = true }: ToolLayoutProps) {
  return (
    <div className={styles.toolLayout}>
      <ToolPageHeader name={toolInfo.name} description={toolInfo.description} />
      <div className={styles.workspace}>
        <form
          className={styles.inputColumn}
          aria-label={inputsLabel}
          noValidate
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
          }}
        >
          {inputs}
        </form>
        <div className={styles.resultsArea} data-sticky={isResultsSticky || undefined}>
          {results}
        </div>
        {guide && <div className={styles.guideArea}>{guide}</div>}
      </div>
    </div>
  );
}
