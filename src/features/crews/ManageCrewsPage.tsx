import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { useI18n } from '@/i18n/useI18n';
import { CrewList } from './components/CrewList/CrewList';
import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { useServerQuery } from '@/hooks/useServerQuery';
import styles from './ManageCrewsPage.module.css';
import { fetchCrews } from './services/crewApi';
import { serverErrorText } from '@/services/serverErrorText';

/** Schermata "Gestisci equipaggio": tutti gli equipaggi salvati, con filtri e ordinamento. */
export function ManageCrewsPage() {
  const { messages } = useI18n();
  const { queryState, reload } = useServerQuery('crews', fetchCrews);

  return (
    <div className={styles.manageCrewsPage}>
      <ToolPageHeader name={messages.tools.manageCrews.name} description={messages.tools.manageCrews.description} />
      {queryState.status === 'loading' && <LoadingStatus>{messages.crews.list.loading}</LoadingStatus>}
      {queryState.status === 'failed' && (
        <LoadError
          message={serverErrorText(messages, queryState.errorKind)}
          retryLabel={messages.crews.list.retry}
          onRetry={reload}
        />
      )}
      {queryState.status === 'loaded' && <CrewList crews={queryState.value} onCrewsDeleted={reload} />}
    </div>
  );
}
