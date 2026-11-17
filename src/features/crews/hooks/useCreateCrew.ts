import { type FormEvent, startTransition, useActionState, useState } from 'react';
import { parseCrewNumber, validateCrewDraft } from '@shared/crewRules';
import { CREW_FORM_FIELDS } from '../crewFormFields';
import type { ServerErrorKind } from '@/services/serverApi';
import { createCrew } from '../services/crewApi';

export type CreateCrewState =
  | { readonly status: 'idle' }
  | { readonly status: 'created'; readonly crewName: string }
  | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };

const INITIAL_STATE: CreateCrewState = { status: 'idle' };

/** Campionati dal campo nascosto (JSON); un testo non valido diventa un valore che la convalida rifiuta. */
const readChampionships = (jsonText: string): unknown => {
  try {
    return jsonText === '' ? [] : (JSON.parse(jsonText) as unknown);
  } catch {
    return null;
  }
};

const readTextField = (formData: FormData, fieldName: string): string => {
  const fieldValue = formData.get(fieldName);
  return typeof fieldValue === 'string' ? fieldValue : '';
};

/**
 * Invio del form con le Actions di React 19: useActionState gestisce esito e attesa.
 * L'action parte da onSubmit dentro una transition (non da <form action>), così React non
 * resetta il form da solo: in caso di errore i dati restano; dopo un salvataggio riuscito
 * cambia formResetKey, che rimonta i campi svuotandoli.
 */
export function useCreateCrew() {
  const [formResetKey, setFormResetKey] = useState(0);

  const [submissionState, dispatchCrewSubmission, isSubmitting] = useActionState<CreateCrewState, FormData>(async (_previousState, formData) => {
    // Le stesse regole del server: un controllo in più prima di disturbare la rete.
    const validation = validateCrewDraft({
      name: readTextField(formData, CREW_FORM_FIELDS.name),
      number: parseCrewNumber(readTextField(formData, CREW_FORM_FIELDS.number)),
      championships: readChampionships(readTextField(formData, CREW_FORM_FIELDS.championships)),
      color: readTextField(formData, CREW_FORM_FIELDS.color),
      discordChannelId: readTextField(formData, CREW_FORM_FIELDS.discordChannelId),
      discordRoleId: readTextField(formData, CREW_FORM_FIELDS.discordRoleId),
    });
    if (!validation.isValid) return { status: 'failed', errorKind: 'invalid-crew' };

    const creationResult = await createCrew(validation.crew);
    if (!creationResult.isSuccess) return { status: 'failed', errorKind: creationResult.errorKind };

    setFormResetKey((previousKey) => previousKey + 1);
    return { status: 'created', crewName: creationResult.value.name };
  }, INITIAL_STATE);

  const handleCrewSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const formData = new FormData(submitEvent.currentTarget);
    startTransition(() => {
      dispatchCrewSubmission(formData);
    });
  };

  return { submissionState, handleCrewSubmit, isSubmitting, formResetKey };
}
