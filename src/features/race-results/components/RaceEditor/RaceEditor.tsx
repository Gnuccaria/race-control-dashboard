import type { SavedCrew } from '@shared/crewRules';
import type { RaceDraft, SavedRace } from '@shared/raceRules';
import { EditingActions } from '@/components/editing/EditingActions';
import { LeaveEditingGuard } from '@/components/editing/LeaveEditingGuard';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Panel } from '@/components/ui/Panel/Panel';
import { useEditingSession } from '@/hooks/useEditingSession';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { useRaceDraft } from '../../hooks/useRaceDraft';
import { toRaceDraftValues } from '../../model/raceDraft';
import { updateRace, updateRaceDriverSwaps } from '../../services/raceApi';
import { RaceForm, type RaceFormTab } from '../RaceForm/RaceForm';
import styles from './RaceEditor.module.css';
import { serverErrorText } from '@/services/serverErrorText';

interface RaceEditorProps {
  readonly savedRace: SavedRace;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly onSaved: (race: SavedRace) => void;
  /** Appena creata: mostra la conferma finché non si inizia a modificare. */
  readonly isNewRace: boolean;
  readonly initialTab?: RaceFormTab;
  /** Schede mostrate (vedi RESULTS_TABS e DRIVER_SWAP_TABS). */
  readonly visibleTabs?: readonly RaceFormTab[];
}

interface RaceEditorFormProps {
  readonly savedRace: SavedRace;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onSave: (race: RaceDraft) => void;
  /** Errore dell'ultimo salvataggio, mostrato subito sopra i pulsanti. */
  readonly saveErrorMessage: string | null;
  readonly initialTab: RaceFormTab | undefined;
  readonly visibleTabs: readonly RaceFormTab[] | undefined;
}

/** Valori in compilazione: rimontando il componente (nuova key) tornano a quelli salvati. */
function RaceEditorForm({
  savedRace,
  crewsQuery,
  isEditing,
  isSaving,
  onEdit,
  onCancel,
  onSave,
  saveErrorMessage,
  initialTab,
  visibleTabs,
}: RaceEditorFormProps) {
  const { decimalSeparator } = useI18n();
  const raceDraft = useRaceDraft(
    toRaceDraftValues(savedRace, decimalSeparator),
    crewsQuery.status === 'loaded' ? crewsQuery.value : undefined,
  );

  return (
    <form
      className={styles.raceEditorForm}
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const validation = raceDraft.validate();
        if (validation.isValid) onSave(validation.race);
      }}
    >
      <RaceForm
        draft={raceDraft}
        crewsQuery={crewsQuery}
        isReadOnly={!isEditing}
       
        {...(initialTab && { initialTab })}
        {...(visibleTabs && { visibleTabs })}
      />
      {/* Subito sopra i pulsanti: il form è lungo e l'esito deve essere visibile dove si è cliccato. */}
      {saveErrorMessage && <InlineAlert>{saveErrorMessage}</InlineAlert>}
      <EditingActions
        isEditing={isEditing}
        isSaving={isSaving}
        canSave={raceDraft.check.isComplete}
        onEdit={onEdit}
        onCancel={onCancel}
      />
    </form>
  );
}

/**
 * Dettaglio della gara con le stesse regole del dettaglio equipaggi: sola lettura, "Modifica",
 * "Salva" con controllo nell'app e sul server, conferma su "Annulla" e all'uscita durante la modifica.
 */
export function RaceEditor({ savedRace, crewsQuery, onSaved, isNewRace, initialTab, visibleTabs }: RaceEditorProps) {
  const { messages } = useI18n();
  const detailTexts = messages.races.detail;
  const isDriverSwapsOnly = visibleTabs?.length === 1 && visibleTabs[0] === 'driverSwaps';
  // Gestisci cambi pilota (Commissari) salva solo i cambi pilota; Gestisci ordini di arrivo la gara senza i cambi pilota.
  const editing = useEditingSession(
    (race: RaceDraft) => (isDriverSwapsOnly ? updateRaceDriverSwaps(savedRace.id, race.driverSwaps) : updateRace(savedRace.id, race)),
    onSaved,
  );
  const hasEditedSinceCreation = editing.isEditing || editing.savedMessageVisible || editing.formKey > 0;

  return (
    <Panel
      title={detailTexts.panelTitle}
      description={
        isDriverSwapsOnly
          ? editing.isEditing
            ? detailTexts.driverSwapsEditingDescription
            : detailTexts.driverSwapsReadOnlyDescription
          : editing.isEditing
            ? detailTexts.editingDescription
            : detailTexts.readOnlyDescription
      }
    >
      {isNewRace && !hasEditedSinceCreation && <InlineAlert tone="success">{detailTexts.created}</InlineAlert>}
      {editing.savedMessageVisible && <InlineAlert tone="success">{messages.editing.saved}</InlineAlert>}
      <RaceEditorForm
        key={editing.formKey}
        savedRace={savedRace}
        crewsQuery={crewsQuery}
        isEditing={editing.isEditing}
        isSaving={editing.isSaving}
        onEdit={editing.startEditing}
        onCancel={editing.cancelEditing}
        onSave={editing.save}
        saveErrorMessage={editing.saveErrorKind ? serverErrorText(messages, editing.saveErrorKind) : null}
        initialTab={initialTab}
        visibleTabs={visibleTabs}
      />
      <LeaveEditingGuard isActive={editing.isEditing} />
    </Panel>
  );
}
