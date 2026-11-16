import styles from './BoardFootnote.module.css';

interface BoardFootnoteProps {
  readonly label: string;
  readonly value: string;
}

/** Dato secondario in fondo alla lavagna, separato da un filo. */
export function BoardFootnote({ label, value }: BoardFootnoteProps) {
  return (
    <p className={styles.boardFootnote}>
      {label} <span className={styles.footnoteValue}>{value}</span>
    </p>
  );
}
