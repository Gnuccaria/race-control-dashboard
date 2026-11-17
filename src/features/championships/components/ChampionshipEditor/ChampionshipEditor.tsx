import type { Championship, ChampionshipDraft } from '@shared/championshipRules';
import { crewCarIn } from '@shared/crewRules';
import { EditingActions } from '@/components/editing/EditingActions';
import { LeaveEditingGuard } from '@/components/editing/LeaveEditingGuard';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Panel } from '@/components/ui/Panel/Panel';
import { fetchCrews } from '@/features/crews/services/crewApi';
import { useEditingSession } from '@/hooks/useEditingSession';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import styles from '../../Championships.module.css';
import { useChampionshipDraft } from '../../hooks/useChampionshipDraft';
import { updateChampionship } from '../../services/championshipApi';
import { ChampionshipFields } from '../ChampionshipFields/ChampionshipFields';
import { serverErrorText } from '@/services/serverErrorText';

interface ChampionshipEditorFormProps {
  readonly savedChampionship: Championship;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onSave: (championship: ChampionshipDraft) => void;
}

/** Campi con i pulsanti di modifica; rimontato (nuova key) torna ai valori salvati. */
function ChampionshipEditorForm({ savedChampionship, isEditing, isSaving, onEdit, onCancel, onSave }: ChampionshipEditorFormProps) {
  const draft = useChampionshipDraft(savedChampionship);
  // Vetture usate dagli equipaggi del campionato: non si tolgono (lo ricontrolla anche il server).
  const { queryState: crewsQuery } = useServerQuery('crews', fetchCrews);
  const lockedCarIds =
    crewsQuery.status === 'loaded'
      ? crewsQuery.value.flatMap((crew) => {
          const carId = crewCarIn(crew, savedChampionship.name);
          return carId === null ? [] : [carId];
        })
      : [];
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const validation = draft.validate();
        if (validation.isValid) onSave(validation.championship);
      }}
    >
      <ChampionshipFields draft={draft} isReadOnly={!isEditing} lockedCarIds={lockedCarIds} />
      <EditingActions isEditing={isEditing} isSaving={isSaving} canSave={draft.isComplete} onEdit={onEdit} onCancel={onCancel} />
    </form>
  );
}

interface ChampionshipEditorProps {
  readonly savedChampionship: Championship;
  readonly onSaved: (championship: Championship) => void;
}

/** Dati del campionato: in sola lettura finché non si preme "Modifica". */
export function ChampionshipEditor({ savedChampionship, onSaved }: ChampionshipEditorProps) {
  const { messages } = useI18n();
  const detailTexts = messages.championships.detail;
  const editing = useEditingSession((championship: ChampionshipDraft) => updateChampionship(savedChampionship.id, championship), onSaved);

  return (
    <Panel title={detailTexts.panelTitle} description={editing.isEditing ? detailTexts.editingDescription : detailTexts.readOnlyDescription}>
      {editing.savedMessageVisible && <InlineAlert tone="success">{messages.editing.saved}</InlineAlert>}
      {editing.saveErrorKind && <InlineAlert>{serverErrorText(messages, editing.saveErrorKind)}</InlineAlert>}
      <ChampionshipEditorForm
        key={editing.formKey}
        savedChampionship={savedChampionship}
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
