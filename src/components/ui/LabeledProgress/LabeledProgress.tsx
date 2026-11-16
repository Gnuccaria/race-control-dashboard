import { ProgressBar } from '../ProgressBar/ProgressBar';
import styles from './LabeledProgress.module.css';

interface LabeledProgressProps {
  readonly label: string;
  /** Testo del conteggio a destra, es. "28 di 30". */
  readonly countText: string;
  readonly value: number;
  readonly maximum: number;
  readonly accessibleLabel: string;
}

/** Barra di avanzamento con etichetta e conteggio sopra. */
export function LabeledProgress({ label, countText, value, maximum, accessibleLabel }: LabeledProgressProps) {
  return (
    <div className={styles.labeledProgress}>
      <p className={styles.progressHeader}>
        <span>{label}</span>
        <span className={styles.progressCount}>{countText}</span>
      </p>
      <ProgressBar value={value} maximum={maximum} accessibleLabel={accessibleLabel} />
    </div>
  );
}
