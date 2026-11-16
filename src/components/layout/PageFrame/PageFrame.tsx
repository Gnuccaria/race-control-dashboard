import type { ReactNode } from 'react';
import { ScrollRestoration } from 'react-router';
import { NavigationIndicator } from '@/app/NavigationIndicator/NavigationIndicator';
import { useI18n } from '@/i18n/useI18n';
import styles from './PageFrame.module.css';

const MAIN_CONTENT_ID = 'main-content';

interface PageFrameProps {
  /** Barra in alto (quella dell'app ha il menu utente, quella del sito no). */
  readonly header: ReactNode;
  readonly children: ReactNode;
}

/** Struttura comune a tutte le pagine dell'app e del sito: link di salto, barra in alto e contenuto. */
export function PageFrame({ header, children }: PageFrameProps) {
  const { messages } = useI18n();

  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
        {messages.app.skipToContent}
      </a>
      <NavigationIndicator />
      {header}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.mainContent}>
        {children}
      </main>
      <ScrollRestoration />
    </>
  );
}
