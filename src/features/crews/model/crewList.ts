import type { CrewChampionship, SavedCrew } from '@shared/crewRules';
import { type SortState, toggleSort } from '@/lib/sorting';

/** Logica pura dell'elenco equipaggi: filtri, ordinamento e dati mancanti. Nessuna dipendenza da React. */

export type CrewSortColumn = 'number' | 'name' | 'car' | 'championship';
export type CrewSort = SortState<CrewSortColumn>;

/** Di default: numero crescente. */
export const DEFAULT_CREW_SORT: CrewSort = { column: 'number', direction: 'ascending' };

/** Primo clic su una colonna: crescente (A→Z); clic successivo sulla stessa colonna: inverte. */
export const toggleCrewSort = (currentSort: CrewSort, clickedColumn: CrewSortColumn): CrewSort =>
  toggleSort(currentSort, clickedColumn);

/** Valore speciale dei filtri: auto mancante in qualche campionato, oppure nessun campionato. */
export const MISSING_VALUE_FILTER = 'missing';

export interface CrewFilters {
  /** Testo libero: cerca nel numero e nel nome. */
  readonly searchText: string;
  /** Id dell'auto come testo (in uno qualsiasi dei campionati); '' = tutte. */
  readonly carId: string;
  /** Campionato a cui partecipa; MISSING_VALUE_FILTER = nessun campionato; '' = tutti. */
  readonly championship: CrewChampionship | typeof MISSING_VALUE_FILTER | '';
}

export const EMPTY_CREW_FILTERS: CrewFilters = { searchText: '', carId: '', championship: '' };

export const hasActiveFilters = (filters: CrewFilters): boolean =>
  filters.searchText.trim() !== '' || filters.carId !== '' || filters.championship !== '';

/** "Café" e "cafe", "GT  Tribe" e "gt tribe" sono uguali per la ricerca. */
const toSearchKey = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Auto: un'auto qualsiasi dei suoi campionati; "mancante" = qualche campionato senza auto. */
function matchesCarFilter(crew: SavedCrew, carFilter: string): boolean {
  if (carFilter === '') return true;
  if (carFilter === MISSING_VALUE_FILTER) return crew.championships.some((entry) => entry.carId === null);
  return crew.championships.some((entry) => String(entry.carId) === carFilter);
}

/** Campionato: vi partecipa; "nessuno" = nessun campionato. */
function matchesChampionshipFilter(crew: SavedCrew, championshipFilter: CrewFilters['championship']): boolean {
  if (championshipFilter === '') return true;
  if (championshipFilter === MISSING_VALUE_FILTER) return crew.championships.length === 0;
  return crew.championships.some((entry) => entry.championship === championshipFilter);
}

/** Applica tutti i filtri insieme; la ricerca trova il testo dentro il numero o dentro il nome. */
export function filterCrews(crews: readonly SavedCrew[], filters: CrewFilters): SavedCrew[] {
  const searchKey = toSearchKey(filters.searchText);
  return crews.filter(
    (crew) =>
      (searchKey === '' || String(crew.number).includes(searchKey) || toSearchKey(crew.name).includes(searchKey)) &&
      matchesCarFilter(crew, filters.carId) &&
      matchesChampionshipFilter(crew, filters.championship),
  );
}

/**
 * Ordina senza modificare l'elenco ricevuto. I testi seguono l'ordine alfabetico della lingua
 * (accenti e maiuscole non contano, "Team 2" prima di "Team 10"); i dati mancanti restano sempre in fondo.
 * A parità di valore decide il numero, così l'ordine è sempre stabile.
 */
export function sortCrews(
  crews: readonly SavedCrew[],
  { column, direction }: CrewSort,
  locale: string,
  /** Nomi delle auto (dal server): l'ordine per auto è alfabetico sul nome. */
  carNameById: ReadonlyMap<number, string> = new Map(),
): SavedCrew[] {
  const textCollator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const directionFactor = direction === 'ascending' ? 1 : -1;

  const compareColumn = (first: SavedCrew, second: SavedCrew): number => {
    if (column === 'number') return (first.number - second.number) * directionFactor;

    // Più campionati: conta il primo (e la sua auto).
    const textValue = (crew: SavedCrew): string | null => {
      if (column === 'name') return crew.name;
      const [firstEntry] = crew.championships;
      if (!firstEntry) return null;
      if (column === 'championship') return firstEntry.championship;
      return firstEntry.carId === null ? null : (carNameById.get(firstEntry.carId) ?? null);
    };
    const firstValue = textValue(first);
    const secondValue = textValue(second);
    if (firstValue === null || secondValue === null) {
      if (firstValue === secondValue) return 0;
      return firstValue === null ? 1 : -1;
    }
    return textCollator.compare(firstValue, secondValue) * directionFactor;
  };

  return [...crews].sort((first, second) => compareColumn(first, second) || first.number - second.number);
}

export type MissingCrewField = 'car' | 'color';

/** Dati ancora vuoti (es. equipaggi importati da CSV): un campionato senza auto, il colore. Mostrano l'avviso nell'elenco. */
export function findMissingCrewFields(crew: SavedCrew): MissingCrewField[] {
  const missingFields: MissingCrewField[] = [];
  if (crew.championships.some((entry) => entry.carId === null)) missingFields.push('car');
  if (crew.color === null) missingFields.push('color');
  return missingFields;
}
