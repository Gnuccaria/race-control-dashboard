import { useParams } from 'react-router';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import type { BackLinkTarget } from '@/components/navigation/BackLink/BackLink';
import { useI18n } from '@/i18n/useI18n';
import styles from './CrewDetailPage.module.css';
import { CrewEditor } from './components/CrewEditor/CrewEditor';
import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { useServerQuery } from '@/hooks/useServerQuery';
import { fetchCrew } from './services/crewApi';

const CREW_ID_PATTERN = /^\d{1,9}$/;

/** Dettaglio di un equipaggio (…/gestisci-equipaggi/:crewId). */
export function CrewDetailPage() {
  const { messages } = useI18n();
  const { crewId = '' } = useParams();
  const isValidCrewId = CREW_ID_PATTERN.test(crewId);

  const { queryState, reload, replaceValue } = useServerQuery(`crew-${crewId}`, async () =>
    isValidCrewId ? fetchCrew(Number(crewId)) : ({ isSuccess: false, errorKind: 'not-found' } as const),
  );

  const backToList: BackLinkTarget = { to: '..', relative: 'path', label: messages.crews.detail.backToList };
  const loadedCrew = queryState.status === 'loaded' ? queryState.value : null;

  return (
    <div className={styles.crewDetailPage}>
      <ToolPageHeader
        name={loadedCrew?.name ?? messages.tools.manageCrews.name}
        description={loadedCrew ? messages.crews.detail.subtitle(loadedCrew.number) : ''}
        backLink={backToList}
      />
      {queryState.status === 'loading' && <LoadingStatus>{messages.crews.detail.loading}</LoadingStatus>}
      {queryState.status === 'failed' && (
        <LoadError
          message={messages.serverErrors[queryState.errorKind]}
          retryLabel={messages.crews.list.retry}
          onRetry={reload}
        />
      )}
      {loadedCrew && <CrewEditor savedCrew={loadedCrew} onSaved={replaceValue} />}
    </div>
  );
}
