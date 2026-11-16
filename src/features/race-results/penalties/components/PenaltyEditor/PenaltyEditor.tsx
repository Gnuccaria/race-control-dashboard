import type { SavedCrew } from '@shared/crewRules';
import type { PenaltyDraft, SavedPenalty } from '@shared/penaltyRules';
import { EditingActions } from '@/components/editing/EditingActions';
import { LeaveEditingGuard } from '@/components/editing/LeaveEditingGuard';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Panel } from '@/components/ui/Panel/Panel';
import { useEditingSession } from '@/hooks/useEditingSession';
import { useI18n } from '@/i18n/useI18n';
import { usePenaltyDraft } from '../../hooks/usePenaltyDraft';
import { toPenaltyDraftValues } from '../../model/penaltyDraft';
import { updatePenalty } from '../../services/penaltyApi';
import { PenaltyFields } from '../PenaltyFields/PenaltyFields';
import styles from './PenaltyEditor.module.css';

interface PenaltyEditorFormProps {
  readonly savedPenalty: SavedPenalty;
  readonly crews: readonly SavedCrew[];
  readonly reprimandCountsBefore: ReadonlyMap<number, number> | undefined;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onSave: (penalty: PenaltyDraft) => void;
}

/** Valori in compilazione: rimontando il componente (nuova key) tornano a quelli salvati. */
function PenaltyEditorForm({ savedPenalty, crews, reprimandCountsBefore, isEditing, isSaving, onEdit, onCancel, onSave }: PenaltyEditorFormProps) {
  const draft = usePenaltyDraft(toPenaltyDraftValues(savedPenalty));
  return (
    <form
      className={styles.penaltyEditorForm}
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const validation = draft.validate();
        if (validation.isValid) onSave(validation.penalty);
      }}
    >
      <PenaltyFields draft={draft} crews={crews} isReadOnly={!isEditing} reprimandCountsBefore={reprimandCountsBefore} />
      <EditingActions isEditing={isEditing} isSaving={isSaving} canSave={draft.check.isComplete} onEdit={onEdit} onCancel={onCancel} />
    </form>
  );
}

interface PenaltyEditorProps {
  readonly savedPenalty: SavedPenalty;
  readonly crews: readonly SavedCrew[];
  readonly reprimandCountsBefore: ReadonlyMap<number, number> | undefined;
  readonly onSaved: (penalty: SavedPenalty) => void;
}

/** Dettaglio della penalità con le stesse regole degli altri dettagli: sola lettura, "Modifica", "Salva" o "Annulla". */
export function PenaltyEditor({ savedPenalty, crews, reprimandCountsBefore, onSaved }: PenaltyEditorProps) {
  const { messages } = useI18n();
  const detailTexts = messages.penalties.detail;
  const editing = useEditingSession((penalty: PenaltyDraft) => updatePenalty(savedPenalty.raceId, savedPenalty.id, penalty), onSaved);

  return (
    <Panel title={detailTexts.panelTitle} description={editing.isEditing ? detailTexts.editingDescription : detailTexts.readOnlyDescription}>
      {editing.savedMessageVisible && <InlineAlert tone="success">{messages.editing.saved}</InlineAlert>}
      {editing.saveErrorKind && <InlineAlert>{messages.serverErrors[editing.saveErrorKind]}</InlineAlert>}
      <PenaltyEditorForm
        key={editing.formKey}
        savedPenalty={savedPenalty}
        crews={crews}
        reprimandCountsBefore={reprimandCountsBefore}
        isEditing={editing.isEditing}
        isSaving={editing.isSaving}
        onEdit={editing.startEditing}
        onCancel={editing.cancelEditing}
        onSave={editing.save}
      />
      <LeaveEditingGuard isActive={editing.isEditing} />
    </Panel>
  );
}
