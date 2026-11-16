export type SortDirection = 'ascending' | 'descending';

export interface SortState<Column extends string> {
  readonly column: Column;
  readonly direction: SortDirection;
}

/** Primo clic su una colonna: crescente (A→Z); clic successivo sulla stessa colonna: inverte. */
export function toggleSort<Column extends string>(currentSort: SortState<Column>, clickedColumn: Column): SortState<Column> {
  if (currentSort.column !== clickedColumn) return { column: clickedColumn, direction: 'ascending' };
  return { column: clickedColumn, direction: currentSort.direction === 'ascending' ? 'descending' : 'ascending' };
}
