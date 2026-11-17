import type { SavedCrew } from '@shared/crewRules';
import { Link } from 'react-router';
import { useI18n } from '@/i18n/useI18n';
import { type CrewSort, type CrewSortColumn, findMissingCrewFields } from '../../model/crewList';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { ChevronRightIcon, MissingDataIcon } from '@/components/data-table/DataTableIcons';
import { SortableColumnHeader } from '@/components/data-table/SortableColumnHeader';
import styles from './CrewTable.module.css';

interface CrewTableProps {
  readonly crews: readonly SavedCrew[];
  readonly sort: CrewSort;
  readonly onSort: (column: CrewSortColumn) => void;
  readonly selectedCrewIds: ReadonlySet<number>;
  readonly onToggleSelection: (crewId: number) => void;
  readonly carNameById: ReadonlyMap<number, string>;
}

/** Prima e dopo la colonna Colore (che non si ordina: un ordine "per colore" non avrebbe un senso evidente). */
const LEADING_SORTABLE_COLUMNS: readonly CrewSortColumn[] = ['number', 'name'];
const TRAILING_SORTABLE_COLUMNS: readonly CrewSortColumn[] = ['car', 'championship'];

/**
 * Tabella degli equipaggi con testate ordinabili e, a destra, il link al dettaglio.
 * Il clic destro su una riga la seleziona o deseleziona (al posto del menu del browser).
 * Funziona anche da tastiera: con il focus sulla freccia della riga, il tasto Menu o Maiusc+F10.
 */
export function CrewTable({ crews, sort, onSort, selectedCrewIds, onToggleSelection, carNameById }: CrewTableProps) {
  const { messages } = useI18n();
  const crewTexts = messages.crews;
  const listTexts = crewTexts.list;
  const missingFieldNames = { car: crewTexts.car, color: crewTexts.color };
  const renderSortableHeader = (column: CrewSortColumn) => (
    <SortableColumnHeader key={column} column={column} label={listTexts.columns[column]} currentSort={sort} onSort={onSort} />
  );

  return (
    <div className={tableStyles.tableScroller}>
      <table className={tableStyles.dataTable} aria-label={listTexts.tableLabel}>
        <thead>
          <tr>
            {LEADING_SORTABLE_COLUMNS.map(renderSortableHeader)}
            <th scope="col" className={tableStyles.plainColumnHeader}>
              {listTexts.columns.color}
            </th>
            {TRAILING_SORTABLE_COLUMNS.map(renderSortableHeader)}
            <td className={tableStyles.actionColumn} />
          </tr>
        </thead>
        <tbody>
          {crews.map((crew) => {
            const missingFields = findMissingCrewFields(crew);
            const isSelected = selectedCrewIds.has(crew.id);
            return (
              <tr
                key={crew.id}
                className={tableStyles.dataRow}
                data-selected={isSelected || undefined}
                onContextMenu={(contextMenuEvent) => {
                  contextMenuEvent.preventDefault();
                  onToggleSelection(crew.id);
                }}
              >
                <td className={tableStyles.numberCell}>{crew.number}</td>
                <td>
                  <span className={styles.nameCell}>
                    {crew.name}
                    {isSelected && <span className={tableStyles.visuallyHidden}>{listTexts.selectedLabel}</span>}
                    {missingFields.length > 0 && (
                      <MissingDataIcon
                        label={listTexts.missingData(missingFields.map((field) => missingFieldNames[field]).join(', '))}
                      />
                    )}
                  </span>
                </td>
                <td>
                  {crew.color ? (
                    <span className={styles.colorDot} style={{ backgroundColor: crew.color }} role="img" aria-label={crew.color} />
                  ) : (
                    <span className={styles.colorDot} data-empty role="img" aria-label={listTexts.noColor} />
                  )}
                </td>
                {/* Un campionato per riga, con l'auto alla stessa altezza nella colonna accanto. */}
                <td>
                  {crew.championships.length === 0 ? (
                    <span className={tableStyles.missingValue}>–</span>
                  ) : (
                    <span className={styles.stackedValues}>
                      {crew.championships.map(({ championship, carId }) => (
                        <span key={championship}>
                          {carId === null ? (
                            <span className={tableStyles.missingValue}>{crewTexts.missingCar}</span>
                          ) : (
                            (carNameById.get(carId) ?? <span className={tableStyles.missingValue}>…</span>)
                          )}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td>
                  {crew.championships.length === 0 ? (
                    <span className={tableStyles.missingValue}>{crewTexts.noChampionship}</span>
                  ) : (
                    <span className={styles.stackedValues}>
                      {crew.championships.map(({ championship }) => (
                        <span key={championship}>{championship}</span>
                      ))}
                    </span>
                  )}
                </td>
                <td className={tableStyles.actionColumn}>
                  {/* Percorso relativo all'URL corrente: …/gestisci-equipaggi → …/gestisci-equipaggi/<id> */}
                  <Link
                    to={String(crew.id)}
                    relative="path"
                    className={tableStyles.detailLink}
                    aria-label={listTexts.openDetails(crew.name)}
                  >
                    <ChevronRightIcon />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
