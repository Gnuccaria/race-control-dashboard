import type { RaceSummary } from '@shared/raceRules';
import { useState } from 'react';
import { EmptyState } from '@/components/data-table/ListStatus';
import { SelectionDeleteBar, type SelectionDeleteTexts } from '@/components/data-table/SelectionDeleteBar';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { useRowSelection } from '@/hooks/useRowSelection';
import { useI18n } from '@/i18n/useI18n';
import { DEFAULT_RACE_SORT, EMPTY_RACE_FILTERS, filterRaces, type RaceFilters, sortRaces, toggleRaceSort } from '../../model/raceList';
import { deleteRaces } from '../../services/raceApi';
import { RaceBrowser } from '../RaceBrowser/RaceBrowser';
import styles from './RaceList.module.css';
import { serverErrorText } from '@/services/serverErrorText';

interface RaceListProps {
  readonly races: readonly RaceSummary[];
  /** Chiamata dopo un'eliminazione riuscita: la pagina rilegge l'elenco dal server. */
  readonly onRacesDeleted: () => void;
}

/** Filtri, conteggio, tabella e azioni sulla selezione, con le stesse regole dell'elenco equipaggi. */
export function RaceList({ races, onRacesDeleted }: RaceListProps) {
  const { locale, messages } = useI18n();
  const listTexts = messages.races.list;
  const sharedListTexts = messages.crews.list;
  const [filters, setFilters] = useState<RaceFilters>(EMPTY_RACE_FILTERS);
  const [sort, setSort] = useState(DEFAULT_RACE_SORT);
  const { selectedIds, toggleSelection, clearSelection } = useRowSelection();
  const { deleteState, isDeleting, deleteSelected } = useBulkDelete(deleteRaces, () => {
    clearSelection();
    onRacesDeleted();
  });

  const deleteTexts: SelectionDeleteTexts = {
    selectedCount: listTexts.selectedCount,
    deleteLabel: sharedListTexts.deleteSelected,
    deletingLabel: sharedListTexts.deleting,
    confirmTitle: listTexts.deleteTitle,
    confirmDescription: listTexts.deleteDescription,
    otherRows: listTexts.otherRaces,
    confirmLabel: sharedListTexts.deleteConfirm,
    cancelLabel: sharedListTexts.deleteCancel,
  };

  const deleteFeedback =
    deleteState.status === 'deleted' ? (
      <InlineAlert tone="success">{listTexts.deleted(deleteState.deletedCount)}</InlineAlert>
    ) : deleteState.status === 'failed' ? (
      <InlineAlert>{serverErrorText(messages, deleteState.errorKind)}</InlineAlert>
    ) : null;

  if (races.length === 0) {
    return (
      <div className={styles.raceList}>
        {deleteFeedback}
        <EmptyState title={listTexts.emptyTitle} description={listTexts.emptyDescription} />
      </div>
    );
  }

  const shownRaces = sortRaces(filterRaces(races, filters), sort, locale);
  const selectedShownRaces = shownRaces.filter((race) => selectedIds.has(race.id));

  return (
    <div className={styles.raceList}>
      {deleteFeedback}
      <RaceBrowser
        races={races}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSort={(column) => {
          setSort((currentSort) => toggleRaceSort(currentSort, column));
        }}
        selection={{ selectedRaceIds: selectedIds, onToggleSelection: toggleSelection }}
        hint={listTexts.selectionHint}
      />
      {selectedShownRaces.length > 0 && (
        <SelectionDeleteBar
          selectedRows={selectedShownRaces.map((race) => ({ id: race.id, label: messages.races.raceLabel(race.round, race.championship) }))}
          texts={deleteTexts}
          isDeleting={isDeleting}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}
