import { useId } from 'react';
import { FieldMessage } from '../FieldMessage/FieldMessage';
import styles from './FractionInput.module.css';
import { type FractionPart, FractionPartInput } from './FractionPartInput';

interface FractionInputProps {
  readonly legend: string;
  readonly hint?: string;
  readonly numerator: FractionPart;
  readonly denominator: FractionPart;
}

/** Due valori nella forma "a / b", come il contatore giri della lobby (es. 3/61). */
export function FractionInput({ legend, hint, numerator, denominator }: FractionInputProps) {
  const messageId = useId();
  const errorMessage = numerator.field.errorMessage ?? denominator.field.errorMessage;
  const message = errorMessage ?? hint;
  const describedById = message ? messageId : undefined;

  return (
    <fieldset className={styles.fractionInput}>
      <legend className={styles.fractionLegend}>{legend}</legend>
      <div className={styles.fractionParts}>
        <FractionPartInput part={numerator} describedById={describedById} />
        <span aria-hidden="true" className={styles.fractionSeparator}>
          /
        </span>
        <FractionPartInput part={denominator} describedById={describedById} />
      </div>
      {message && (
        <FieldMessage id={messageId} isError={errorMessage !== undefined}>
          {message}
        </FieldMessage>
      )}
    </fieldset>
  );
}
