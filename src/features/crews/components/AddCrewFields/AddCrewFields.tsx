import { useCrewDraft } from '../../hooks/useCrewDraft';
import { CrewFields } from '../CrewFields/CrewFields';
import { SubmitCrewButton } from '../SubmitCrewButton/SubmitCrewButton';

interface AddCrewFieldsProps {
  readonly isSubmitting: boolean;
}

/** Campi del nuovo equipaggio e pulsante di creazione, attivo solo con dati validi. */
export function AddCrewFields({ isSubmitting }: AddCrewFieldsProps) {
  const crewDraft = useCrewDraft();

  return (
    <>
      <CrewFields draft={crewDraft} />
      <SubmitCrewButton isDraftComplete={crewDraft.isComplete} isSubmitting={isSubmitting} />
    </>
  );
}
