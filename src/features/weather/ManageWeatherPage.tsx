import type { RaceSummary } from '@shared/raceRules';
import { useState } from 'react';
import { EmptyState, ServerQueryStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { RaceBrowser } from '@/features/race-results/components/RaceBrowser/RaceBrowser';
import { DEFAULT_RACE_SORT, EMPTY_RACE_FILTERS, type RaceFilters, toggleRaceSort } from '@/features/race-results/model/raceList';
import { fetchRaces } from '@/features/race-results/services/raceApi';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import styles from './Weather.module.css';

function WeatherRaceList({ races }: { readonly races: readonly RaceSummary[] }) {
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

/** "Crea pattern meteo" (Direttore Gara): tutte le gare, anche future; il dettaglio mostra le righe del pattern. */
export function ManageWeatherPage() {
  const { messages } = useI18n();
  const { queryState, reload } = useServerQuery('races', fetchRaces);
  return (
    <div className={styles.page}>
      <ToolPageHeader name={messages.tools.weatherPattern.name} description={messages.tools.weatherPattern.description} />
      <ServerQueryStatus queryState={queryState} loadingText={messages.races.list.loading} onRetry={reload} />
      {queryState.status === 'loaded' && <WeatherRaceList races={queryState.value} />}
    </div>
  );
}
