import type { SavedCrew } from '@shared/crewRules';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { useCreateRace } from '../../hooks/useCreateRace';
import { useRaceDraft } from '../../hooks/useRaceDraft';
import { RaceForm } from '../RaceForm/RaceForm';
import styles from './CreateRaceForm.module.css';
import { serverErrorText } from '@/services/serverErrorText';

interface CreateRaceFormProps {
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
}

/** Nuova gara: schede Anagrafica e Dettagli, poi "Salva gara" (attivo solo senza errori). */
export function CreateRaceForm({ crewsQuery }: CreateRaceFormProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  const raceDraft = useRaceDraft(undefined, crewsQuery.status === 'loaded' ? crewsQuery.value : undefined);
  const { createErrorKind, isCreating, submitRace } = useCreateRace();

  return (
    <form
      className={styles.createRaceForm}
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        // Controllo lato client prima di contattare il server (che verifica anche round ed equipaggi).
        const validation = raceDraft.validate();
        if (validation.isValid) submitRace(validation.race);
      }}
    >
      <RaceForm draft={raceDraft} crewsQuery={crewsQuery} isReadOnly={false} />
      {/* Subito sopra il pulsante: il form è lungo e l'esito deve essere visibile dove si è cliccato. */}
      {createErrorKind && <InlineAlert>{serverErrorText(messages, createErrorKind)}</InlineAlert>}
      <Button type="submit" variant="confirm" disabled={!raceDraft.check.isComplete || isCreating}>
        {isCreating ? formTexts.savingRace : formTexts.saveRace}
      </Button>
    </form>
  );
}
