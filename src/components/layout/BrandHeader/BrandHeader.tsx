import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from '@/components/ui/BrandMark/BrandMark';
import styles from './BrandHeader.module.css';

interface BrandHeaderProps {
  readonly name: string;
  /** Parola accanto al nome, più leggera (es. "Risultati" nel sito). */
  readonly tagline?: string;
  /** Contenuto a destra (es. il menu utente dell'app). */
  readonly children?: ReactNode;
}

/** Barra in alto con il marchio che riporta alla pagina iniziale. */
export function BrandHeader({ name, tagline, children }: BrandHeaderProps) {
  return (
    <header className={styles.headerBar}>
      <div className={styles.headerContent}>
        <Link to="/" className={styles.brandLink}>
          <BrandMark />
          <span>{name}</span>
          {tagline && <span className={styles.brandTagline}>{tagline}</span>}
        </Link>
        {children}
      </div>
    </header>
  );
}
