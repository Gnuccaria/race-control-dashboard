import { type ReactNode, useId } from 'react';
import styles from './HighlightBoard.module.css';

export interface FigurePart {
  readonly value: string;
  readonly unit?: string;
}

interface HighlightBoardProps {
  readonly title: string;
  /** Cifra principale, eventualmente in più parti: [{ value: '3', unit: 'min' }, { value: '53', unit: 's' }]. null = nessun risultato. */
  readonly figureParts: readonly FigurePart[] | null;
  /** Testo e dettagli sotto la cifra. */
  readonly children?: ReactNode;
}

const EMPTY_FIGURE_TEXT = '–';

const describeFigure = (figureParts: readonly FigurePart[]) =>
  figureParts.map(({ value, unit }) => (unit ? `${value} ${unit}` : value)).join(' ');

/**
 * La lavagna dei box: il risultato da leggere a colpo d'occhio.
 * Quando la cifra cambia viene rimontata (key) per una breve dissolvenza che segnala il ricalcolo.
 */
export function HighlightBoard({ title, figureParts, children }: HighlightBoardProps) {
  const titleId = useId();
  const figureText = figureParts ? describeFigure(figureParts) : EMPTY_FIGURE_TEXT;

  return (
    <section aria-labelledby={titleId} className={styles.highlightBoard}>
      <h2 id={titleId} className={styles.boardTitle}>
        {title}
      </h2>
      <output
        key={figureText}
        aria-labelledby={titleId}
        aria-live="polite"
        data-empty={!figureParts || undefined}
        className={styles.boardFigure}
      >
        {figureParts ? (
          figureParts.map(({ value, unit }) => (
            <span key={`${value}${unit ?? ''}`} className={styles.figurePart}>
              <span className={styles.figureValue}>{value}</span>
              {unit && <span className={styles.figureUnit}>{unit}</span>}
            </span>
          ))
        ) : (
          <span className={styles.figureValue}>{EMPTY_FIGURE_TEXT}</span>
        )}
      </output>
      {children && <div className={styles.boardContent}>{children}</div>}
    </section>
  );
}
