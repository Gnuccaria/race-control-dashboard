import type { SavedCrew } from '@shared/crewRules';
import { useState } from 'react';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { EmptyState } from '@/components/data-table/ListStatus';
import { SelectionDeleteBar, type SelectionDeleteTexts } from '@/components/data-table/SelectionDeleteBar';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import { useChampionships } from '@/features/championships/useChampionships';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { useRowSelection } from '@/hooks/useRowSelection';
import { useI18n } from '@/i18n/useI18n';
import { deleteCrews } from '../../services/crewApi';
import {
  type CrewFilters,
  DEFAULT_CREW_SORT,
  EMPTY_CREW_FILTERS,
  filterCrews,
  hasActiveFilters,
  sortCrews,
  toggleCrewSort,
} from '../../model/crewList';
import { CrewFilterBar } from '../CrewFilterBar/CrewFilterBar';
import { CrewTable } from '../CrewTable/CrewTable';
import styles from './CrewList.module.css';

interface CrewListProps {
  readonly crews: readonly SavedCrew[];
  /** Chiamata dopo un'eliminazione riuscita: la pagina rilegge l'elenco dal server. */
  readonly onCrewsDeleted: () => void;
}

/**
 * Filtri, conteggio, tabella e azioni sulla selezione. L'elenco mostrato è derivato a ogni render
 * da filtri e ordinamento; si elimina solo ciò che è selezionato e visibile con i filtri correnti.
 */
export function CrewList({ crews, onCrewsDeleted }: CrewListProps) {
  const { locale, messages } = useI18n();
  const listTexts = messages.crews.list;
  const [filters, setFilters] = useState<CrewFilters>(EMPTY_CREW_FILTERS);
  const [sort, setSort] = useState(DEFAULT_CREW_SORT);
  // Auto dal server: nomi per tabella e ordinamento, voci del filtro (ricaricate a ogni uso del menu).
  const carCatalog = useCarCatalog();
  const championshipCatalog = useChampionships();
  const { selectedIds, toggleSelection, clearSelection } = useRowSelection();
  const { deleteState, isDeleting, deleteSelected } = useBulkDelete(deleteCrews, () => {
    clearSelection();
    onCrewsDeleted();
  });
  const deleteTexts: SelectionDeleteTexts = {
    selectedCount: listTexts.selectedCount,
    deleteLabel: listTexts.deleteSelected,
    deletingLabel: listTexts.deleting,
    confirmTitle: listTexts.deleteTitle,
    confirmDescription: listTexts.deleteDescription,
    otherRows: listTexts.otherCrews,
    confirmLabel: listTexts.deleteConfirm,
    cancelLabel: listTexts.deleteCancel,
  };

  const deleteFeedback =
    deleteState.status === 'deleted' ? (
      <InlineAlert tone="success">{listTexts.deleted(deleteState.deletedCount)}</InlineAlert>
    ) : deleteState.status === 'failed' ? (
      <InlineAlert>{messages.serverErrors[deleteState.errorKind]}</InlineAlert>
    ) : null;

  if (crews.length === 0) {
    return (
      <div className={styles.crewList}>
        {deleteFeedback}
        <EmptyState title={listTexts.emptyTitle} description={listTexts.emptyDescription} />
      </div>
    );
  }

  const shownCrews = sortCrews(filterCrews(crews, filters), sort, locale, carCatalog.carNameById);
  const selectedShownCrews = shownCrews.filter((crew) => selectedIds.has(crew.id));

  return (
    <div className={styles.crewList}>
      {deleteFeedback}
      <CrewFilterBar filters={filters} onFiltersChange={setFilters} carCatalog={carCatalog} championshipCatalog={championshipCatalog} />
      <div className={tableStyles.tableCaption}>
        <p aria-live="polite">{listTexts.resultCount(shownCrews.length, crews.length)}</p>
        <p>{listTexts.selectionHint}</p>
      </div>
      {shownCrews.length > 0 ? (
        <CrewTable
          crews={shownCrews}
          sort={sort}
          onSort={(column) => {
            setSort((currentSort) => toggleCrewSort(currentSort, column));
          }}
          selectedCrewIds={selectedIds}
          onToggleSelection={toggleSelection}
          carNameById={carCatalog.carNameById}
        />
      ) : (
        <EmptyState
          title={listTexts.noMatches}
          action={
            hasActiveFilters(filters) && (
              <Button
                onClick={() => {
                  setFilters(EMPTY_CREW_FILTERS);
                }}
              >
                {listTexts.clearFilters}
              </Button>
            )
          }
        />
      )}
      {selectedShownCrews.length > 0 && (
        <SelectionDeleteBar
          selectedRows={selectedShownCrews.map((crew) => ({ id: crew.id, label: crew.name }))}
          texts={deleteTexts}
          isDeleting={isDeleting}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}
