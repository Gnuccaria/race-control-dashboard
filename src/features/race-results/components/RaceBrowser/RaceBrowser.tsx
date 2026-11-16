import type { RaceSummary } from '@shared/raceRules';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { EmptyState } from '@/components/data-table/ListStatus';
import { Button } from '@/components/ui/Button/Button';
import { useTrackLabels } from '@/features/tracks/useTrackLabels';
import { useI18n } from '@/i18n/useI18n';
import {
  EMPTY_RACE_FILTERS,
  filterRaces,
  hasActiveRaceFilters,
  listRaceTrackOptions,
  type RaceFilters,
  type RaceSort,
  sortRaces,
} from '../../model/raceList';
import { RaceFilterBar } from '../RaceFilterBar/RaceFilterBar';
import { RaceTable, type RaceTableProps } from '../RaceTable/RaceTable';

interface RaceBrowserProps extends Pick<RaceTableProps, 'onSort' | 'columns' | 'selection' | 'detailPath'> {
  /** Tutte le gare: filtri e ordinamento si applicano qui. */
  readonly races: readonly RaceSummary[];
  readonly filters: RaceFilters;
  readonly onFiltersChange: (filters: RaceFilters) => void;
  readonly sort: RaceSort;
  /** Indicazione a destra del conteggio (es. "Clic destro per selezionare"). */
  readonly hint?: string;
}

/**
 * Elenco delle gare consultabile: filtri (con le piste presenti nelle gare), conteggio, tabella
 * ordinabile e messaggio quando nessuna gara corrisponde. Lo usano l'app e il sito dei risultati;
 * chi lo usa decide dove tenere filtri e ordinamento (stato del componente o indirizzo della pagina).
 */
export function RaceBrowser({ races, filters, onFiltersChange, sort, hint, ...tableProps }: RaceBrowserProps) {
  const { locale, messages } = useI18n();
  const listTexts = messages.races.list;
  const { trackLabel } = useTrackLabels();
  const trackOptions = listRaceTrackOptions(
    races,
    (race) => trackLabel({ name: race.trackName ?? '', configuration: race.trackConfiguration }, false),
    locale,
  );
  const shownRaces = sortRaces(filterRaces(races, filters), sort, locale);

  return (
    <>
      <RaceFilterBar filters={filters} onFiltersChange={onFiltersChange} trackOptions={trackOptions} />
      <div className={tableStyles.tableCaption}>
        <p aria-live="polite">{listTexts.resultCount(shownRaces.length, races.length)}</p>
        {hint && <p>{hint}</p>}
      </div>
      {shownRaces.length > 0 ? (
        <RaceTable races={shownRaces} sort={sort} {...tableProps} />
      ) : (
        <EmptyState
          title={listTexts.noMatches}
          action={
            hasActiveRaceFilters(filters) && (
              <Button
                onClick={() => {
                  onFiltersChange(EMPTY_RACE_FILTERS);
                }}
              >
                {messages.crews.list.clearFilters}
              </Button>
            )
          }
        />
      )}
    </>
  );
}
