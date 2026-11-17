import type { ValidationMessageKey } from '@/i18n/messages';

/** Regola di conversione di un campo: dal testo digitato al valore usato nei calcoli. */
export interface FieldParser<ParsedValue> {
  readonly parse: (rawValue: string) => ParsedValue | null;
  /** Messaggio (tradotto) che spiega come correggere il valore quando parse restituisce null. */
  readonly errorKey: ValidationMessageKey;
}

export type FieldParserSchema = Record<string, FieldParser<unknown>>;

export type ParsedFields<Schema extends FieldParserSchema> = {
  readonly [FieldName in keyof Schema]: Schema[FieldName] extends FieldParser<infer ParsedValue> ? ParsedValue : never;
};

export type FieldErrors<Schema extends FieldParserSchema> = Partial<Record<keyof Schema, ValidationMessageKey>>;

export interface ParseFormFieldsResult<Schema extends FieldParserSchema> {
  /** null se almeno un campo non è valido. */
  readonly values: ParsedFields<Schema> | null;
  readonly fieldErrors: FieldErrors<Schema>;
}

/** Converte tutti i campi descritti dallo schema e raccoglie il messaggio di errore di ogni campo non valido. */
export function parseFormFields<Schema extends FieldParserSchema>(
  fieldParsers: Schema,
  rawValues: Record<keyof Schema, string>,
): ParseFormFieldsResult<Schema> {
  const parsedValues: Partial<Record<keyof Schema, unknown>> = {};
  const fieldErrors: FieldErrors<Schema> = {};

  for (const [fieldName, { parse, errorKey }] of Object.entries(fieldParsers) as [keyof Schema, FieldParser<unknown>][]) {
    const parsedValue = parse(rawValues[fieldName]);
    if (parsedValue === null) fieldErrors[fieldName] = errorKey;
    else parsedValues[fieldName] = parsedValue;
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return { values: hasErrors ? null : (parsedValues as ParsedFields<Schema>), fieldErrors };
}
