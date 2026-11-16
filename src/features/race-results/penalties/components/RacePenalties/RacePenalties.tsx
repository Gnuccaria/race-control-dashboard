import type { SavedCrew } from '@shared/crewRules';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { EmptyState, LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { SelectionDeleteBar, type SelectionDeleteTexts } from '@/components/data-table/SelectionDeleteBar';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { ButtonLink } from '@/components/navigation/ButtonLink/ButtonLink';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { useRowSelection } from '@/hooks/useRowSelection';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { violationLabel } from '../../model/violationLabel';
import { deletePenalties, fetchPenalties } from '../../services/penaltyApi';
import { PenaltyTable } from '../PenaltyTable/PenaltyTable';
import styles from './RacePenalties.module.css';

interface RacePenaltiesProps {
  /** null per una gara non ancora salvata: le penalità si aggiungono dopo il primo salvataggio. */
  readonly raceId: number | null;
  readonly allCrews: readonly SavedCrew[];
}

/**
 * Scheda "Penalità" del dettaglio gara: "Aggiungi penalità" sopra la tabella, clic destro per selezionare
 * ed "Elimina" con conferma, come negli altri elenchi. Le penalità si salvano subito, indipendentemente
 * da "Modifica"/"Salva" della gara.
 */
export function RacePenalties({ raceId, allCrews }: RacePenaltiesProps) {
  if (raceId === null) return <RacePenaltiesUnsaved />;
  return <SavedRacePenalties raceId={raceId} allCrews={allCrews} />;
}

function RacePenaltiesUnsaved() {
  const { messages } = useI18n();
  return <p className={styles.notice}>{messages.penalties.list.saveRaceFirst}</p>;
}

function SavedRacePenalties({ raceId, allCrews }: { readonly raceId: number; readonly allCrews: readonly SavedCrew[] }) {
  const { messages } = useI18n();
  const texts = messages.penalties.list;
  const sharedListTexts = messages.crews.list;
  const { queryState, reload } = useServerQuery(`race-${raceId}-penalties`, () => fetchPenalties(raceId));
  const { selectedIds, toggleSelection, clearSelection } = useRowSelection();
  const { deleteState, isDeleting, deleteSelected } = useBulkDelete(
    (penaltyIds) => deletePenalties(raceId, penaltyIds),
    () => {
      clearSelection();
      reload();
    },
  );
  const crewById = new Map(allCrews.map((crew) => [crew.id, crew]));

  const deleteTexts: SelectionDeleteTexts = {
    selectedCount: texts.selectedCount,
    deleteLabel: sharedListTexts.deleteSelected,
    deletingLabel: sharedListTexts.deleting,
    confirmTitle: texts.deleteTitle,
    confirmDescription: texts.deleteDescription,
    otherRows: texts.otherPenalties,
    confirmLabel: sharedListTexts.deleteConfirm,
    cancelLabel: sharedListTexts.deleteCancel,
  };

  const penalties = queryState.status === 'loaded' ? queryState.value : [];
  const selectedPenalties = penalties.filter((penalty) => selectedIds.has(penalty.id));

  return (
    <div className={styles.racePenalties}>
      <div className={styles.toolbar}>
        {/* Relativo al dettaglio: …/<raceId> → …/<raceId>/penalita/nuova */}
        <ButtonLink to="penalita/nuova" relative="path">
          {texts.addPenalty}
        </ButtonLink>
      </div>
      {deleteState.status === 'deleted' && <InlineAlert tone="success">{texts.deleted(deleteState.deletedCount)}</InlineAlert>}
      {deleteState.status === 'failed' && <InlineAlert>{messages.serverErrors[deleteState.errorKind]}</InlineAlert>}
      {queryState.status === 'loading' && <LoadingStatus>{texts.loading}</LoadingStatus>}
      {queryState.status === 'failed' && (
        <LoadError message={messages.serverErrors[queryState.errorKind]} retryLabel={sharedListTexts.retry} onRetry={reload} />
      )}
      {queryState.status === 'loaded' &&
        (penalties.length === 0 ? (
          <EmptyState title={texts.emptyTitle} description={texts.emptyDescription} />
        ) : (
          <>
            <div className={tableStyles.tableCaption}>
              <p aria-live="polite">{texts.count(penalties.length)}</p>
              <p>{texts.selectionHint}</p>
            </div>
            <PenaltyTable penalties={penalties} crewById={crewById} selectedPenaltyIds={selectedIds} onToggleSelection={toggleSelection} />
          </>
        ))}
      {selectedPenalties.length > 0 && (
        <SelectionDeleteBar
          selectedRows={selectedPenalties.map((penalty) => ({ id: penalty.id, label: `"${violationLabel(penalty, messages)}"` }))}
          texts={deleteTexts}
          isDeleting={isDeleting}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}
