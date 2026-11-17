import type { Championship } from '@shared/championshipRules';
import { Link } from 'react-router';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { ChevronRightIcon } from '@/components/data-table/DataTableIcons';
import { EmptyState } from '@/components/data-table/ListStatus';
import { SelectionDeleteBar, type SelectionDeleteTexts } from '@/components/data-table/SelectionDeleteBar';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { useRowSelection } from '@/hooks/useRowSelection';
import { useI18n } from '@/i18n/useI18n';
import { deleteChampionships } from '../../services/championshipApi';
import styles from './ChampionshipList.module.css';
import { serverErrorText } from '@/services/serverErrorText';

interface ChampionshipListProps {
  readonly championships: readonly Championship[];
  /** Dopo un'eliminazione riuscita la pagina rilegge l'elenco dal server. */
  readonly onChampionshipsDeleted: () => void;
}

/**
 * Tabella dei campionati (nome, durate con lo stint, vetture ammesse) con il link al dettaglio.
 * Il clic destro su una riga la seleziona o deseleziona; i selezionati si eliminano dalla barra in basso
 * (non quelli con gare salvate: il server rifiuta l'eliminazione e lo si dice).
 */
export function ChampionshipList({ championships, onChampionshipsDeleted }: ChampionshipListProps) {
  const { messages } = useI18n();
  const texts = messages.championships;
  const listTexts = texts.list;
  const carCatalog = useCarCatalog();
  const { selectedIds, toggleSelection, clearSelection } = useRowSelection();
  const { deleteState, isDeleting, deleteSelected } = useBulkDelete(deleteChampionships, () => {
    clearSelection();
    onChampionshipsDeleted();
  });
  const deleteTexts: SelectionDeleteTexts = {
    selectedCount: listTexts.selectedCount,
    deleteLabel: listTexts.deleteSelected,
    deletingLabel: listTexts.deleting,
    confirmTitle: listTexts.deleteTitle,
    confirmDescription: listTexts.deleteDescription,
    otherRows: listTexts.otherChampionships,
    confirmLabel: listTexts.deleteConfirm,
    cancelLabel: listTexts.deleteCancel,
  };
  const selectedChampionships = championships.filter((championship) => selectedIds.has(championship.id));

  return (
    <div className={styles.championshipList}>
      {deleteState.status === 'deleted' && <InlineAlert tone="success">{listTexts.deleted(deleteState.deletedCount)}</InlineAlert>}
      {deleteState.status === 'failed' && <InlineAlert>{serverErrorText(messages, deleteState.errorKind)}</InlineAlert>}
      {championships.length === 0 ? (
        <EmptyState title={listTexts.emptyTitle} description={listTexts.emptyDescription} />
      ) : (
        <>
          <div className={tableStyles.tableCaption}>
            <p>{listTexts.count(championships.length)}</p>
            <p>{listTexts.selectionHint}</p>
          </div>
          <div className={tableStyles.tableScroller}>
            <table className={tableStyles.dataTable} aria-label={listTexts.tableLabel}>
              <thead>
                <tr>
                  <th scope="col" className={tableStyles.plainColumnHeader}>
                    {listTexts.columns.name}
                  </th>
                  <th scope="col" className={tableStyles.plainColumnHeader}>
                    {listTexts.columns.durations}
                  </th>
                  <th scope="col" className={tableStyles.plainColumnHeader}>
                    {listTexts.columns.cars}
                  </th>
                  <td className={tableStyles.actionColumn} />
                </tr>
              </thead>
              <tbody>
                {championships.map((championship) => {
                  const isSelected = selectedIds.has(championship.id);
                  const carNames = championship.carIds.map((carId) => carCatalog.carNameById.get(carId)).filter((name) => name !== undefined);
                  return (
                    <tr
                      key={championship.id}
                      className={tableStyles.dataRow}
                      data-selected={isSelected || undefined}
                      onContextMenu={(contextMenuEvent) => {
                        contextMenuEvent.preventDefault();
                        toggleSelection(championship.id);
                      }}
                    >
                      <td>
                        {championship.name}
                        {isSelected && <span className={tableStyles.visuallyHidden}>{listTexts.selectedLabel}</span>}
                      </td>
                      <td>
                        <span className={styles.stackedValues}>
                          {championship.durations.map((duration) => (
                            <span key={duration.hours}>{texts.durationShort(duration.hours, duration.stintMinutes)}</span>
                          ))}
                        </span>
                      </td>
                      <td title={carNames.join(', ')}>{listTexts.carCount(championship.carIds.length)}</td>
                      <td className={tableStyles.actionColumn}>
                        {/* Relativo all'URL corrente: …/gestisci-campionati → …/gestisci-campionati/<id> */}
                        <Link to={String(championship.id)} relative="path" className={tableStyles.detailLink} aria-label={listTexts.openDetails(championship.name)}>
                          <ChevronRightIcon />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {selectedChampionships.length > 0 && (
        <SelectionDeleteBar
          selectedRows={selectedChampionships.map((championship) => ({ id: championship.id, label: championship.name }))}
          texts={deleteTexts}
          isDeleting={isDeleting}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}
