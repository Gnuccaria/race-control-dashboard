import type { FieldBinding } from '@/components/form/fieldBinding';
import { useI18n } from '@/i18n/useI18n';
import { type FieldParserSchema, parseFormFields } from '@/lib/form/parseFormFields';
import { type AllowedValueCheck, reviveStoredForm, type TextForm } from '@/lib/form/reviveStoredForm';
import { usePersistentState } from './usePersistentState';

interface PersistentFormOptions<Schema extends FieldParserSchema, Form extends TextForm> {
  readonly storageKey: string;
  readonly defaultForm: Form;
  /** Campi di testo da convertire e convalidare. */
  readonly fieldParsers: Schema;
  /** Convalida aggiuntiva dei valori salvati (es. un'opzione di un elenco). */
  readonly isAllowedValue?: AllowedValueCheck<Form>;
}

/**
 * Stato di un form salvato tra una sessione e l'altra. Conserva il testo digitato,
 * ne ricava i valori convertiti e gli errori durante il render (niente stato duplicato)
 * e fornisce i collegamenti pronti per i campi, con i messaggi di errore nella lingua corrente.
 */
export function usePersistentForm<Schema extends FieldParserSchema, Form extends TextForm & Record<keyof Schema, string>>({
  storageKey,
  defaultForm,
  fieldParsers,
  isAllowedValue,
}: PersistentFormOptions<Schema, Form>) {
  const [form, setForm] = usePersistentState(storageKey, defaultForm, (storedValue) =>
    reviveStoredForm(storedValue, defaultForm, isAllowedValue),
  );
  const { messages } = useI18n();
  const { values, fieldErrors } = parseFormFields(fieldParsers, form);

  const updateField = <FieldName extends keyof Form>(fieldName: FieldName, nextValue: Form[FieldName]) => {
    setForm((previousForm) => ({ ...previousForm, [fieldName]: nextValue }));
  };

  const bindField = (fieldName: keyof Schema & keyof Form): FieldBinding => {
    const fieldErrorKey = fieldErrors[fieldName];
    return {
      value: form[fieldName],
      errorMessage: fieldErrorKey && messages.validation[fieldErrorKey],
      onValueChange: (nextValue) => {
        updateField(fieldName, nextValue as Form[typeof fieldName]);
      },
    };
  };

  return { form, values, fieldErrors, updateField, bindField };
}
