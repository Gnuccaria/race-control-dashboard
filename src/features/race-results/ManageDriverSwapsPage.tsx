import type { RaceSummary } from '@shared/raceRules';
import { useState } from 'react';
import { EmptyState, ServerQueryStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import styles from './ManageRacesPage.module.css';
import { RaceBrowser } from './components/RaceBrowser/RaceBrowser';
import { DEFAULT_RACE_SORT, EMPTY_RACE_FILTERS, type RaceFilters, toggleRaceSort } from './model/raceList';
import { fetchRaces } from './services/raceApi';

/** Stessa tabella di "Gestisci ordini di arrivo", senza selezione né eliminazione: si apre una gara per i suoi cambi pilota. */
function DriverSwapRaceList({ races }: { readonly races: readonly RaceSummary[] }) {
  const { messages } = useI18n();
  const [filters, setFilters] = useState<RaceFilters>(EMPTY_RACE_FILTERS);
  const [sort, setSort] = useState(DEFAULT_RACE_SORT);
  if (races.length === 0) return <EmptyState title={messages.races.list.emptyTitle} description={messages.races.list.emptyDescription} />;
  return (
    <RaceBrowser
      races={races}
      filters={filters}
      onFiltersChange={setFilters}
      sort={sort}
      onSort={(column) => {
        setSort((currentSort) => toggleRaceSort(currentSort, column));
      }}
    />
  );
}

/** "Gestisci cambi pilota" (Commissari Sportivi): le gare come in Gestisci ordini di arrivo; il dettaglio mostra solo i cambi pilota. */
export function ManageDriverSwapsPage() {
  const { messages } = useI18n();
  const { queryState, reload } = useServerQuery('races', fetchRaces);

  return (
    <div className={styles.manageRacesPage}>
      <ToolPageHeader name={messages.tools.manageDriverSwaps.name} description={messages.tools.manageDriverSwaps.description} />
      <ServerQueryStatus queryState={queryState} loadingText={messages.races.list.loading} onRetry={reload} />
      {queryState.status === 'loaded' && <DriverSwapRaceList races={queryState.value} />}
    </div>
  );
}
