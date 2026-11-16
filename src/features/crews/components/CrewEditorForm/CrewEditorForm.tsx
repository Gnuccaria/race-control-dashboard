import type { CrewDraft, SavedCrew } from '@shared/crewRules';
import { EditingActions } from '@/components/editing/EditingActions';
import { useCrewDraft } from '../../hooks/useCrewDraft';
import { CrewFields } from '../CrewFields/CrewFields';
import styles from './CrewEditorForm.module.css';

interface CrewEditorFormProps {
  readonly savedCrew: SavedCrew;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onSave: (crew: CrewDraft) => void;
}

/**
 * Campi dell'equipaggio con i pulsanti di modifica. I valori in compilazione vivono qui:
 * rimontando il componente (nuova key) tornano a quelli salvati.
 */
export function CrewEditorForm({ savedCrew, isEditing, isSaving, onEdit, onCancel, onSave }: CrewEditorFormProps) {
  const crewDraft = useCrewDraft(savedCrew);

  return (
    <form
      className={styles.crewEditorForm}
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        // Controllo lato client prima di contattare il server (che poi verifica anche l'unicità).
        const validation = crewDraft.validate();
        if (validation.isValid) onSave(validation.crew);
      }}
    >
      <CrewFields draft={crewDraft} isReadOnly={!isEditing} />
      <EditingActions
        isEditing={isEditing}
        isSaving={isSaving}
        canSave={crewDraft.isComplete}
        onEdit={onEdit}
        onCancel={onCancel}
      />
    </form>
  );
}
