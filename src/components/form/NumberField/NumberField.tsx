import type { FieldBinding } from '../fieldBinding';
import { FormField } from '../FormField/FormField';
import { InputWithUnit } from '../InputWithUnit/InputWithUnit';

interface NumberFieldProps {
  readonly label: string;
  readonly unit: string;
  readonly field: FieldBinding;
  readonly hint?: string;
  readonly step?: number;
}

/** Campo numerico completo: etichetta, valore con unità di misura, suggerimento o errore. */
export function NumberField({ label, unit, field, hint, step }: NumberFieldProps) {
  return (
    <FormField label={label} hint={hint} errorMessage={field.errorMessage}>
      {(controlProps) => <InputWithUnit field={field} controlProps={controlProps} unit={unit} step={step} />}
    </FormField>
  );
}
