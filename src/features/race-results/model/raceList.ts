import type { CrewChampionship } from '@shared/crewRules';
import type { RaceSummary } from '@shared/raceRules';
import { type SortState, toggleSort } from '@/lib/sorting';

/** Logica pura dell'elenco gare: filtri e ordinamento. Nessuna dipendenza da React. */

export type RaceSortColumn = 'championship' | 'round' | 'name' | 'track' | 'raceDate' | 'updatedAt';
export type RaceSort = SortState<RaceSortColumn>;

/** Di default: le gare più recenti per prime. */
export const DEFAULT_RACE_SORT: RaceSort = { column: 'raceDate', direction: 'descending' };

export const toggleRaceSort = (currentSort: RaceSort, clickedColumn: RaceSortColumn): RaceSort =>
  toggleSort(currentSort, clickedColumn);

export interface RaceFilters {
  /** '' = tutti. */
  readonly championship: CrewChampionship | '';
  /** '' = tutti; altrimenti l'id della pista (configurazione) come testo. */
  readonly trackId: string;
  /** AAAA-MM-GG, '' = nessun limite. Entrambi i limiti sono inclusi. */
  readonly fromDate: string;
  readonly toDate: string;
}

export const EMPTY_RACE_FILTERS: RaceFilters = { championship: '', trackId: '', fromDate: '', toDate: '' };

export const hasActiveRaceFilters = (filters: RaceFilters): boolean =>
  filters.championship !== '' || filters.trackId !== '' || filters.fromDate !== '' || filters.toDate !== '';

export interface RaceTrackOption {
  readonly value: string;
  readonly label: string;
}

/** Piste usate nelle gare elencate (una voce per configurazione), in ordine alfabetico: le scelte del filtro Tracciato. */
export function listRaceTrackOptions(races: readonly RaceSummary[], labelOf: (race: RaceSummary) => string, locale: string): RaceTrackOption[] {
  const optionsByTrackId = new Map<number, RaceTrackOption>();
  for (const race of races) {
    if (race.trackId !== null && !optionsByTrackId.has(race.trackId)) {
      optionsByTrackId.set(race.trackId, { value: String(race.trackId), label: labelOf(race) });
    }
  }
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...optionsByTrackId.values()].sort((first, second) => collator.compare(first.label, second.label));
}

/** Le date ISO (AAAA-MM-GG) si confrontano correttamente anche come testo. */
export function filterRaces(races: readonly RaceSummary[], filters: RaceFilters): RaceSummary[] {
  return races.filter(
    (race) =>
      (filters.championship === '' || race.championship === filters.championship) &&
      (filters.trackId === '' || String(race.trackId) === filters.trackId) &&
      (filters.fromDate === '' || race.raceDate >= filters.fromDate) &&
      (filters.toDate === '' || race.raceDate <= filters.toDate),
  );
}

/**
 * Ordina senza modificare l'elenco ricevuto. I testi seguono l'ordine alfabetico della lingua,
 * le gare senza pista restano in fondo; a parità decide la data più recente, poi il round.
 */
export function sortRaces(races: readonly RaceSummary[], { column, direction }: RaceSort, locale: string): RaceSummary[] {
  const textCollator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const directionFactor = direction === 'ascending' ? 1 : -1;

  const compareColumn = (first: RaceSummary, second: RaceSummary): number => {
    switch (column) {
      case 'round':
        return (first.round - second.round) * directionFactor;
      case 'championship':
        return textCollator.compare(first.championship, second.championship) * directionFactor;
      case 'raceDate':
        return first.raceDate.localeCompare(second.raceDate) * directionFactor;
      case 'updatedAt':
        return first.updatedAt.localeCompare(second.updatedAt) * directionFactor;
      case 'name':
        // Le gare senza nome restano in fondo in entrambe le direzioni.
        if (first.name === null || second.name === null) {
          if (first.name === second.name) return 0;
          return first.name === null ? 1 : -1;
        }
        return textCollator.compare(first.name, second.name) * directionFactor;
      case 'track':
        if (first.trackName === null || second.trackName === null) {
          if (first.trackName === second.trackName) return 0;
          return first.trackName === null ? 1 : -1;
        }
        return (
          (textCollator.compare(first.trackName, second.trackName) ||
            textCollator.compare(first.trackConfiguration ?? '', second.trackConfiguration ?? '')) * directionFactor
        );
    }
  };

  return [...races].sort(
    (first, second) =>
      compareColumn(first, second) || second.raceDate.localeCompare(first.raceDate) || first.round - second.round,
  );
}
