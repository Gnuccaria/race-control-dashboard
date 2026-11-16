export type TextForm = Record<string, string>;

export type AllowedValueCheck<Form extends TextForm> = (fieldName: keyof Form, value: string) => boolean;

/**
 * Ricostruisce un form da dati salvati, potenzialmente incompleti, corrotti o di
 * una versione precedente: tiene solo i campi noti, di tipo testo e ammessi.
 */
export function reviveStoredForm<Form extends TextForm>(
  storedValue: unknown,
  defaultForm: Form,
  isAllowedValue: AllowedValueCheck<Form> = () => true,
): Form | null {
  if (typeof storedValue !== 'object' || storedValue === null) return null;
  const storedRecord = storedValue as Record<string, unknown>;

  const revivedForm: TextForm = { ...defaultForm };
  for (const fieldName of Object.keys(defaultForm)) {
    const storedFieldValue = storedRecord[fieldName];
    if (typeof storedFieldValue === 'string' && isAllowedValue(fieldName, storedFieldValue)) {
      revivedForm[fieldName] = storedFieldValue;
    }
  }
  return revivedForm as Form;
}
