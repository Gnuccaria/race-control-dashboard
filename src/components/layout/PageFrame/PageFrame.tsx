import type { ReactNode } from 'react';
import { ScrollRestoration } from 'react-router';
import { NavigationIndicator } from '@/app/NavigationIndicator/NavigationIndicator';
import { useI18n } from '@/i18n/useI18n';
import styles from './PageFrame.module.css';

const MAIN_CONTENT_ID = 'main-content';

interface PageFrameProps {
  /** Barra in alto (quella dell'app ha il menu utente, quella del sito no). */
  readonly header: ReactNode;
  /** Menu laterale (solo nell'app): a sinistra del contenuto, sopra nelle finestre strette. */
  readonly sideMenu?: ReactNode;
  readonly children: ReactNode;
}

/** Struttura comune a tutte le pagine dell'app e del sito: link di salto, barra in alto e contenuto. */
export function PageFrame({ header, sideMenu, children }: PageFrameProps) {
  const { messages } = useI18n();

  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
        {messages.app.skipToContent}
      </a>
      <NavigationIndicator />
      {header}
      {sideMenu ? (
        <div className={styles.withSideMenu}>
          {sideMenu}
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.mainContent}>
            {children}
          </main>
        </div>
      ) : (
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.mainContent}>
          {children}
        </main>
      )}
      <ScrollRestoration />
    </>
  );
}
