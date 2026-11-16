/** Collegamento tra un campo del form e il suo stato. */
export interface FieldBinding {
  readonly value: string;
  /** Presente solo quando il valore non è valido. */
  readonly errorMessage?: string | undefined;
  readonly onValueChange: (nextValue: string) => void;
}

/** Attributi che un campo riceve dal FormField che lo contiene. */
export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly isInvalid: boolean;
}
