import type { ReactNode } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  readonly label: string;
  readonly description?: string;
  readonly isChecked: boolean;
  readonly onCheckedChange: (isChecked: boolean) => void;
  /** Contenuto decorativo dentro il pallino (es. un'icona che cambia con lo stato). */
  readonly thumbContent?: ReactNode;
}

/** Interruttore on/off: checkbox nativa con ruolo "switch", etichetta cliccabile per intero. */
export function Switch({ label, description, isChecked, onCheckedChange, thumbContent }: SwitchProps) {
  return (
    <label className={styles.switchField}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {description && <span className={styles.switchDescription}>{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={styles.switchInput}
        checked={isChecked}
        onChange={(changeEvent) => {
          onCheckedChange(changeEvent.currentTarget.checked);
        }}
      />
      <span aria-hidden="true" className={styles.switchTrack}>
        <span className={styles.switchThumb}>{thumbContent}</span>
      </span>
    </label>
  );
}
