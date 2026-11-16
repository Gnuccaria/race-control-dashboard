import { MinusIcon, PlusIcon } from '@/components/ui/Icon/StepperIcons';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Input } from '@/components/ui/Input/Input';
import type { FieldBinding, FieldControlProps } from '../fieldBinding';
import styles from './NumberStepper.module.css';

interface NumberStepperProps {
  readonly field: FieldBinding;
  readonly controlProps: FieldControlProps;
  readonly minimum: number;
  readonly maximum?: number;
  readonly decrementLabel: string;
  readonly incrementLabel: string;
  /** Testo accanto al valore, es. "di 6". */
  readonly suffix?: string;
}

const clamp = (value: number, minimum: number, maximum = Number.POSITIVE_INFINITY) =>
  Math.min(Math.max(value, minimum), maximum);

/** Campo numerico intero con pulsanti − / +, comodo da usare durante la gara. */
export function NumberStepper({
  field,
  controlProps,
  minimum,
  maximum,
  decrementLabel,
  incrementLabel,
  suffix,
}: NumberStepperProps) {
  const { isInvalid, ...inputAttributes } = controlProps;
  const currentValue = Number(field.value) || 0;

  const changeValueBy = (delta: number) => {
    field.onValueChange(String(clamp(Math.round(currentValue) + delta, minimum, maximum)));
  };

  return (
    <div className={styles.numberStepper}>
      <IconButton
        accessibleLabel={decrementLabel}
        disabled={currentValue <= minimum}
        onClick={() => {
          changeValueBy(-1);
        }}
      >
        <MinusIcon />
      </IconButton>
      <Input
        {...inputAttributes}
        type="number"
        min={minimum}
        max={maximum}
        step={1}
        className={styles.stepperValueInput}
        isInvalid={isInvalid}
        value={field.value}
        onValueChange={field.onValueChange}
      />
      <IconButton
        accessibleLabel={incrementLabel}
        disabled={maximum !== undefined && currentValue >= maximum}
        onClick={() => {
          changeValueBy(1);
        }}
      >
        <PlusIcon />
      </IconButton>
      {suffix && <span className={styles.stepperSuffix}>{suffix}</span>}
    </div>
  );
}
