import { useId } from 'react';
import { Input } from '@/components/ui/Input/Input';
import type { FieldBinding } from '../fieldBinding';
import styles from './FractionInput.module.css';

export interface FractionPart {
  readonly label: string;
  readonly field: FieldBinding;
}

interface FractionPartInputProps {
  readonly part: FractionPart;
  readonly describedById: string | undefined;
}

/** Una metà della frazione: campo numerico con didascalia sotto. */
export function FractionPartInput({ part, describedById }: FractionPartInputProps) {
  const inputId = useId();

  return (
    <div className={styles.fractionPart}>
      <Input
        id={inputId}
        type="number"
        min={0}
        step={1}
        className={styles.fractionPartInput}
        isInvalid={part.field.errorMessage !== undefined}
        aria-describedby={describedById}
        value={part.field.value}
        onValueChange={part.field.onValueChange}
      />
      <label htmlFor={inputId} className={styles.fractionPartLabel}>
        {part.label}
      </label>
    </div>
  );
}
