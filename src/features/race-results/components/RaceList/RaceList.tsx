import type { RaceSummary } from '@shared/raceRules';
import { useState } from 'react';
import { BulkDeleteFeedback } from '@/components/data-table/BulkDeleteFeedback';
import { EmptyState } from '@/components/data-table/ListStatus';
import { SelectionDeleteBar } from '@/components/data-table/SelectionDeleteBar';
import { useSelectionDelete } from '@/hooks/useSelectionDelete';
import { useI18n } from '@/i18n/useI18n';
import { DEFAULT_RACE_SORT, EMPTY_RACE_FILTERS, filterRaces, type RaceFilters, sortRaces, toggleRaceSort } from '../../model/raceList';
import { deleteRaces } from '../../services/raceApi';
import { RaceBrowser } from '../RaceBrowser/RaceBrowser';
import styles from './RaceList.module.css';

interface RaceListProps {
  readonly races: readonly RaceSummary[];
  /** Chiamata dopo un'eliminazione riuscita: la pagina rilegge l'elenco dal server. */
  readonly onRacesDeleted: () => void;
}

/** Filtri, conteggio, tabella e azioni sulla selezione, con le stesse regole dell'elenco equipaggi. */
export function RaceList({ races, onRacesDeleted }: RaceListProps) {
  const { locale, messages } = useI18n();
  const listTexts = messages.races.list;
  const [filters, setFilters] = useState<RaceFilters>(EMPTY_RACE_FILTERS);
  const [sort, setSort] = useState(DEFAULT_RACE_SORT);
  const { selectedIds, toggleSelection, deleteState, isDeleting, deleteSelected, selectedAmong } = useSelectionDelete(deleteRaces, onRacesDeleted);
  const deleteFeedback = <BulkDeleteFeedback deleteState={deleteState} deletedText={listTexts.deleted} />;

  if (races.length === 0) {
    return (
      <div className={styles.raceList}>
        {deleteFeedback}
        <EmptyState title={listTexts.emptyTitle} description={listTexts.emptyDescription} />
      </div>
    );
  }

  const shownRaces = sortRaces(filterRaces(races, filters), sort, locale);
  const selectedShownRaces = selectedAmong(shownRaces);

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
          texts={{ selectedCount: listTexts.selectedCount, confirmTitle: listTexts.deleteTitle, confirmDescription: listTexts.deleteDescription, otherRows: listTexts.otherRaces }}
          isDeleting={isDeleting}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}
