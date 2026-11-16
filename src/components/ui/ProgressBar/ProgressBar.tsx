import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  readonly value: number;
  readonly maximum: number;
  readonly accessibleLabel: string;
}

/** Barra di avanzamento sottile basata sull'elemento nativo <progress>. */
export function ProgressBar({ value, maximum, accessibleLabel }: ProgressBarProps) {
  const safeMaximum = Math.max(maximum, 1);
  return (
    <progress
      className={styles.progressBar}
      value={Math.min(value, safeMaximum)}
      max={safeMaximum}
      aria-label={accessibleLabel}
    />
  );
}
