import type { RaceSummary } from '@shared/raceRules';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { ChevronRightIcon } from '@/components/data-table/DataTableIcons';
import { SortableColumnHeader } from '@/components/data-table/SortableColumnHeader';
import { useTrackLabels } from '@/features/tracks/useTrackLabels';
import { useI18n } from '@/i18n/useI18n';
import { formatIsoDate, formatTimestamp } from '@/lib/dateFormatting';
import type { RaceSort, RaceSortColumn } from '../../model/raceList';

const COLUMN_CLASS_NAMES: Partial<Record<RaceSortColumn, string>> = {
  round: tableStyles.numberCell,
  updatedAt: tableStyles.missingValue,
};

export interface RaceSelection {
  readonly selectedRaceIds: ReadonlySet<number>;
  readonly onToggleSelection: (raceId: number) => void;
}

export interface RaceTableProps {
  readonly races: readonly RaceSummary[];
  readonly sort: RaceSort;
  readonly onSort: (column: RaceSortColumn) => void;
  /** Colonne mostrate, nell'ordine (di default tutte). */
  readonly columns?: readonly RaceSortColumn[];
  /** Selezione col tasto destro (app); senza, le righe non si selezionano (sito). */
  readonly selection?: RaceSelection;
  /** Indirizzo del dettaglio; di default l'id, relativo alla pagina corrente (…/ordini-di-arrivo/<id>). */
  readonly detailPath?: (race: RaceSummary) => string;
}

export const ALL_RACE_COLUMNS: readonly RaceSortColumn[] = ['championship', 'round', 'name', 'track', 'raceDate', 'updatedAt'];

/**
 * Tabella delle gare: testate ordinabili, clic destro per selezionare (come negli equipaggi, se previsto)
 * e, a destra, il link al dettaglio. La usano sia l'app sia il sito dei risultati.
 */
export function RaceTable({
  races,
  sort,
  onSort,
  columns = ALL_RACE_COLUMNS,
  selection,
  detailPath,
}: RaceTableProps) {
  const { locale, messages } = useI18n();
  const listTexts = messages.races.list;
  const { trackLabel } = useTrackLabels();

  return (
    <div className={tableStyles.tableScroller}>
      <table className={tableStyles.dataTable} aria-label={listTexts.tableLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <SortableColumnHeader key={column} column={column} label={listTexts.columns[column]} currentSort={sort} onSort={onSort} />
            ))}
            <td className={tableStyles.actionColumn} />
          </tr>
        </thead>
        <tbody>
          {races.map((race) => {
            const isSelected = selection?.selectedRaceIds.has(race.id) ?? false;
            const raceLabel = race.name ?? messages.races.raceLabel(race.round, race.championship);
            const missingValue = <span className={tableStyles.missingValue}>{listTexts.noTrack}</span>;
            const cells: Record<RaceSortColumn, ReactNode> = {
              championship: race.championship,
              round: race.round,
              name: race.name ?? missingValue,
              track:
                race.trackName === null
                  ? missingValue
                  : trackLabel({ name: race.trackName, configuration: race.trackConfiguration }, race.isTrackReversed),
              raceDate: formatIsoDate(race.raceDate, locale),
              updatedAt: formatTimestamp(race.updatedAt, locale),
            };
            return (
              <tr
                key={race.id}
                className={tableStyles.dataRow}
                data-selected={isSelected || undefined}
                onContextMenu={
                  selection &&
                  ((contextMenuEvent) => {
                    contextMenuEvent.preventDefault();
                    selection.onToggleSelection(race.id);
                  })
                }
              >
                {columns.map((column, columnIndex) => (
                  <td key={column} className={COLUMN_CLASS_NAMES[column]}>
                    {cells[column]}
                    {columnIndex === 0 && isSelected && <span className={tableStyles.visuallyHidden}>{messages.crews.list.selectedLabel}</span>}
                  </td>
                ))}
                <td className={tableStyles.actionColumn}>
                  {/* Di default relativo all'URL corrente: …/ordini-di-arrivo → …/ordini-di-arrivo/<id> */}
                  <Link
                    to={detailPath ? detailPath(race) : String(race.id)}
                    relative={detailPath ? undefined : 'path'}
                    className={tableStyles.detailLink}
                    aria-label={listTexts.openDetails(raceLabel)}
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
