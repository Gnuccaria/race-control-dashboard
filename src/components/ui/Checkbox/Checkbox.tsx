import styles from './Checkbox.module.css';

interface CheckboxProps {
  readonly label: string;
  readonly description?: string;
  readonly isChecked: boolean;
  readonly onCheckedChange: (isChecked: boolean) => void;
  readonly isDisabled?: boolean;
}

/** Casella di spunta nativa con etichetta cliccabile ed eventuale descrizione. */
export function Checkbox({ label, description, isChecked, onCheckedChange, isDisabled = false }: CheckboxProps) {
  return (
    <label className={styles.checkboxField}>
      <input
        type="checkbox"
        className={styles.checkboxInput}
        checked={isChecked}
        disabled={isDisabled}
        onChange={(changeEvent) => {
          onCheckedChange(changeEvent.currentTarget.checked);
        }}
      />
      <span className={styles.checkboxText}>
        <span className={styles.checkboxLabel}>{label}</span>
        {description && <span className={styles.checkboxDescription}>{description}</span>}
      </span>
    </label>
  );
}
