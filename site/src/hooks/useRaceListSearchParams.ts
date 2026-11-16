import { isCrewChampionship } from '@shared/crewRules';
import { isIsoDate } from '@shared/raceRules';
import { useSearchParams } from 'react-router';
import {
  DEFAULT_RACE_SORT,
  type RaceFilters,
  type RaceSort,
  type RaceSortColumn,
  toggleRaceSort,
} from '@/features/race-results/model/raceList';

/** Nomi dei parametri nell'indirizzo: /?campionato=…&pista=12&dal=2026-01-01&al=…&ordine=raceDate-descending */
const PARAM = { championship: 'campionato', trackId: 'pista', fromDate: 'dal', toDate: 'al', sort: 'ordine' } as const;
const SORT_COLUMNS: readonly RaceSortColumn[] = ['championship', 'round', 'name', 'track', 'raceDate', 'updatedAt'];

function readSort(sortText: string | null): RaceSort {
  const [column, direction] = (sortText ?? '').split('-');
  const sortColumn = SORT_COLUMNS.find((candidate) => candidate === column);
  return sortColumn && (direction === 'ascending' || direction === 'descending') ? { column: sortColumn, direction } : DEFAULT_RACE_SORT;
}

/**
 * Filtri e ordinamento dell'elenco delle gare tenuti nell'indirizzo della pagina: si possono
 * condividere, sopravvivono al ricaricamento e il tasto "indietro" del browser li ripristina.
 * Valori non validi (scritti a mano nell'indirizzo) vengono ignorati.
 */
export function useRaceListSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const readText = (name: string) => searchParams.get(name) ?? '';
  const championship = readText(PARAM.championship);
  const trackId = readText(PARAM.trackId);
  const fromDate = readText(PARAM.fromDate);
  const toDate = readText(PARAM.toDate);

  const filters: RaceFilters = {
    championship: isCrewChampionship(championship) ? championship : '',
    trackId: /^\d{1,9}$/.test(trackId) ? trackId : '',
    fromDate: isIsoDate(fromDate) ? fromDate : '',
    toDate: isIsoDate(toDate) ? toDate : '',
  };
  const sort = readSort(searchParams.get(PARAM.sort));

  /** Aggiorna i parametri indicati e toglie quelli vuoti, senza riempire la cronologia a ogni tasto. */
  const updateParams = (changes: Partial<Record<keyof typeof PARAM, string>>) => {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        for (const [key, value] of Object.entries(changes) as [keyof typeof PARAM, string][]) {
          if (value) nextParams.set(PARAM[key], value);
          else nextParams.delete(PARAM[key]);
        }
        return nextParams;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  return {
    filters,
    sort,
    setFilters: (nextFilters: RaceFilters) => {
      updateParams(nextFilters);
    },
    toggleSort: (column: RaceSortColumn) => {
      const nextSort = toggleRaceSort(sort, column);
      const isDefault = nextSort.column === DEFAULT_RACE_SORT.column && nextSort.direction === DEFAULT_RACE_SORT.direction;
      updateParams({ sort: isDefault ? '' : `${nextSort.column}-${nextSort.direction}` });
    },
  };
}
