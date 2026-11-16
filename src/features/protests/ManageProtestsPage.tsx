import type { Protest } from '@shared/protestRules';
import { Link } from 'react-router';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { StatusBadge } from '@/components/ui/StatusBadge/StatusBadge';
import { ChevronRightIcon } from '@/components/data-table/DataTableIcons';
import { EmptyState, LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { formatTimestamp } from '@/lib/dateFormatting';
import styles from './Protests.module.css';
import { fetchProtests } from './services/protestApi';

export const crewLabel = (crew: Protest['crew']) => `#${crew.number} ${crew.name}`;

function ProtestTable({ protests }: { readonly protests: readonly Protest[] }) {
  const { locale, messages } = useI18n();
  const texts = messages.protests;
  return (
    <div className={tableStyles.tableScroller}>
      <table className={tableStyles.dataTable} aria-label={texts.tableLabel}>
        <thead>
          <tr>
            <th scope="col" className={tableStyles.plainColumnHeader}>{texts.columns.number}</th>
            <th scope="col" className={tableStyles.plainColumnHeader}>{texts.columns.crew}</th>
            <th scope="col" className={tableStyles.plainColumnHeader}>{texts.columns.otherCrews}</th>
            <th scope="col" className={tableStyles.plainColumnHeader}>{texts.columns.stint}</th>
            <th scope="col" className={tableStyles.plainColumnHeader}>{texts.columns.lap}</th>
            <th scope="col" className={tableStyles.plainColumnHeader}>{texts.columns.sentAt}</th>
            <th scope="col" className={tableStyles.plainColumnHeader}>{texts.columns.status}</th>
            <td className={tableStyles.actionColumn} />
          </tr>
        </thead>
        <tbody>
          {protests.map((protest) => (
            <tr key={protest.id} className={tableStyles.dataRow}>
              <td className={tableStyles.numberCell}>{protest.id}</td>
              <td>{crewLabel(protest.crew)}</td>
              <td>
                {protest.otherCrews.length === 0 ? (
                  <span className={tableStyles.missingValue}>{texts.noOtherCrews}</span>
                ) : (
                  <span className={styles.crewChips}>
                    {protest.otherCrews.map((crew) => (
                      <span key={crew.id} className={styles.crewChip} title={crew.name}>
                        #{crew.number}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td className={tableStyles.numberCell}>{protest.stint}</td>
              <td className={tableStyles.numberCell}>{protest.lap}</td>
              <td>{formatTimestamp(protest.createdAt, locale)}</td>
              <td>
                <StatusBadge tone={protest.status === 'rejected' ? 'critical' : 'warning'} label={texts.statuses[protest.status]} />
              </td>
              <td className={tableStyles.actionColumn}>
                <Link to={String(protest.id)} relative="path" className={tableStyles.detailLink} aria-label={texts.openDetails(protest.id)}>
                  <ChevronRightIcon />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Gestisci proteste" (Commissari Sportivi): le proteste mandate dal sito, dalla più recente; la freccia apre il dettaglio. */
export function ManageProtestsPage() {
  const { messages } = useI18n();
  const texts = messages.protests;
  const { queryState, reload } = useServerQuery('protests', fetchProtests);

  return (
    <div className={styles.protestsPage}>
      <ToolPageHeader name={messages.tools.manageProtests.name} description={messages.tools.manageProtests.description} />
      {queryState.status === 'loading' && <LoadingStatus>{texts.loading}</LoadingStatus>}
      {queryState.status === 'failed' && (
        <LoadError message={messages.serverErrors[queryState.errorKind]} retryLabel={messages.crews.list.retry} onRetry={reload} />
      )}
      {queryState.status === 'loaded' &&
        (queryState.value.length === 0 ? <EmptyState title={texts.emptyTitle} description={texts.emptyDescription} /> : <ProtestTable protests={queryState.value} />)}
    </div>
  );
}
