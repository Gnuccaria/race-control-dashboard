import { Input } from '@/components/ui/Input/Input';
import type { FieldBinding, FieldControlProps } from '../fieldBinding';
import styles from './InputWithUnit.module.css';

interface InputWithUnitProps {
  readonly field: FieldBinding;
  readonly controlProps: FieldControlProps;
  readonly unit: string;
  readonly step?: number;
}

/** Campo numerico con l'unità di misura dentro il bordo (es. "120 s"). */
export function InputWithUnit({ field, controlProps, unit, step }: InputWithUnitProps) {
  const { isInvalid, ...inputAttributes } = controlProps;

  return (
    <div className={styles.inputWithUnit} data-invalid={isInvalid || undefined}>
      <Input
        {...inputAttributes}
        type="number"
        min={0}
        step={step}
        isBare
        isInvalid={isInvalid}
        value={field.value}
        onValueChange={field.onValueChange}
      />
      <span aria-hidden="true" className={styles.unitLabel}>
        {unit}
      </span>
    </div>
  );
}
