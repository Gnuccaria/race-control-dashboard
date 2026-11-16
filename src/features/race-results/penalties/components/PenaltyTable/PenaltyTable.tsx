import type { SavedCrew } from '@shared/crewRules';
import { isReprimandGridPenalty, type SavedPenalty } from '@shared/penaltyRules';
import { Link } from 'react-router';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { ChevronRightIcon } from '@/components/data-table/DataTableIcons';
import { useI18n } from '@/i18n/useI18n';
import { violationLabel } from '../../model/violationLabel';
import { formatTimestamp } from '@/lib/dateFormatting';
import styles from './PenaltyTable.module.css';

interface PenaltyTableProps {
  readonly penalties: readonly SavedPenalty[];
  /** Tutti gli equipaggi, per mostrare i numeri delle vetture coinvolte. */
  readonly crewById: ReadonlyMap<number, SavedCrew>;
  readonly selectedPenaltyIds: ReadonlySet<number>;
  readonly onToggleSelection: (penaltyId: number) => void;
}

/** Penalità della gara: vetture coinvolte, violazione, decisione di ogni vettura; clic destro per selezionare, freccia per il dettaglio. */
export function PenaltyTable({ penalties, crewById, selectedPenaltyIds, onToggleSelection }: PenaltyTableProps) {
  const { locale, messages } = useI18n();
  const texts = messages.penalties.list;
  const crewNumber = (crewId: number) => crewById.get(crewId)?.number ?? '?';

  return (
    <div className={tableStyles.tableScroller}>
      <table className={tableStyles.dataTable} aria-label={texts.tableLabel}>
        <thead>
          <tr>
            <th scope="col" className={tableStyles.plainColumnHeader}>
              {texts.columns.crews}
            </th>
            <th scope="col" className={tableStyles.plainColumnHeader}>
              {texts.columns.violation}
            </th>
            <th scope="col" className={tableStyles.plainColumnHeader}>
              {texts.columns.decisions}
            </th>
            <th scope="col" className={tableStyles.plainColumnHeader}>
              {texts.columns.updatedAt}
            </th>
            <td className={tableStyles.actionColumn} />
          </tr>
        </thead>
        <tbody>
          {penalties.map((penalty) => {
            const isSelected = selectedPenaltyIds.has(penalty.id);
            const crewNumbers = penalty.crews.map((crew) => `#${crewNumber(crew.crewId)}`);
            const decidedCrews = penalty.crews.filter((crew) => crew.decision !== null);
            return (
              <tr
                key={penalty.id}
                className={tableStyles.dataRow}
                data-selected={isSelected || undefined}
                onContextMenu={(contextMenuEvent) => {
                  contextMenuEvent.preventDefault();
                  onToggleSelection(penalty.id);
                }}
              >
                <td>
                  <span className={styles.chips}>
                    {crewNumbers.map((label) => (
                      <span key={label} className={styles.chip}>
                        {label}
                      </span>
                    ))}
                  </span>
                  {isSelected && <span className={tableStyles.visuallyHidden}>{messages.crews.list.selectedLabel}</span>}
                </td>
                <td className={styles.violationCell}>{violationLabel(penalty, messages)}</td>
                <td>
                  {/* Una riga per vettura con decisione; senza decisioni, "Nessuna azione ulteriore" (come nel referto). */}
                  {decidedCrews.length === 0 ? (
                    <span className={tableStyles.missingValue}>{messages.penalties.form.noFurtherAction}</span>
                  ) : (
                    <ul className={styles.decisionList}>
                      {decidedCrews.map((crew) => (
                        <li key={crew.crewId}>
                          <span className={styles.decisionCar}>#{crewNumber(crew.crewId)}</span>
                          {crew.decision === 'reprimand' && crew.reprimandNumber !== null
                            ? texts.reprimandNumber(crew.reprimandNumber)
                            : crew.decision && messages.penalties.decisions[crew.decision]}
                          {/* Terza reprimenda: penalità automatica in griglia nella gara successiva. */}
                          {isReprimandGridPenalty(crew.reprimandNumber) && <span className={styles.automaticPenalty}>{texts.automaticGridPenalty}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className={tableStyles.missingValue}>{formatTimestamp(penalty.updatedAt, locale)}</td>
                <td className={tableStyles.actionColumn}>
                  {/* Relativo al dettaglio della gara: …/<raceId> → …/<raceId>/penalita/<id> */}
                  <Link
                    to={`penalita/${penalty.id}`}
                    relative="path"
                    className={tableStyles.detailLink}
                    aria-label={texts.openDetails(crewNumbers.join(', '), violationLabel(penalty, messages))}
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
