import type { CrewDraft, SavedCrew } from '@shared/crewRules';
import { LeaveEditingGuard } from '@/components/editing/LeaveEditingGuard';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Panel } from '@/components/ui/Panel/Panel';
import { useEditingSession } from '@/hooks/useEditingSession';
import { useI18n } from '@/i18n/useI18n';
import { updateCrew } from '../../services/crewApi';
import { CrewEditorForm } from '../CrewEditorForm/CrewEditorForm';
import { serverErrorText } from '@/services/serverErrorText';

interface CrewEditorProps {
  readonly savedCrew: SavedCrew;
  readonly onSaved: (crew: SavedCrew) => void;
}

/** Dati dell'equipaggio: in sola lettura finché non si preme "Modifica". */
export function CrewEditor({ savedCrew, onSaved }: CrewEditorProps) {
  const { messages } = useI18n();
  const detailTexts = messages.crews.detail;
  const editing = useEditingSession((crew: CrewDraft) => updateCrew(savedCrew.id, crew), onSaved);

  return (
    <Panel
      title={detailTexts.panelTitle}
      description={editing.isEditing ? detailTexts.editingDescription : detailTexts.readOnlyDescription}
    >
      {editing.savedMessageVisible && <InlineAlert tone="success">{messages.editing.saved}</InlineAlert>}
      {editing.saveErrorKind && <InlineAlert>{serverErrorText(messages, editing.saveErrorKind)}</InlineAlert>}
      <CrewEditorForm
        key={editing.formKey}
        savedCrew={savedCrew}
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
