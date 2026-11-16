import type { SortState } from '@/lib/sorting';
import { SortDirectionIcon } from './DataTableIcons';
import styles from './SortableColumnHeader.module.css';

interface SortableColumnHeaderProps<Column extends string> {
  readonly column: Column;
  readonly label: string;
  readonly currentSort: SortState<Column>;
  readonly onSort: (column: Column) => void;
}

/** Testata cliccabile: aria-sort comunica agli screen reader colonna e direzione attive. */
export function SortableColumnHeader<Column extends string>({ column, label, currentSort, onSort }: SortableColumnHeaderProps<Column>) {
  const isSortedColumn = currentSort.column === column;

  return (
    <th scope="col" aria-sort={isSortedColumn ? currentSort.direction : undefined} className={styles.columnHeader}>
      <button
        type="button"
        className={styles.sortButton}
        data-active={isSortedColumn || undefined}
        onClick={() => {
          onSort(column);
        }}
      >
        {label}
        {isSortedColumn && <SortDirectionIcon key={column} direction={currentSort.direction} />}
      </button>
    </th>
  );
}
