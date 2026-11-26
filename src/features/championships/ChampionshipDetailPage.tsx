import { useParams } from 'react-router';
import { ServerQueryStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import type { BackLinkTarget } from '@/components/navigation/BackLink/BackLink';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import styles from './Championships.module.css';
import { ChampionshipEditor } from './components/ChampionshipEditor/ChampionshipEditor';
import { fetchChampionship } from './services/championshipApi';

const CHAMPIONSHIP_ID_PATTERN = /^\d{1,9}$/;

/** Dettaglio di un campionato (…/gestisci-campionati/:championshipId). */
export function ChampionshipDetailPage() {
  const { messages } = useI18n();
  const texts = messages.championships;
  const { championshipId = '' } = useParams();
  const isValidId = CHAMPIONSHIP_ID_PATTERN.test(championshipId);
  const { queryState, reload, replaceValue } = useServerQuery(`championship-${championshipId}`, async () =>
    isValidId ? fetchChampionship(Number(championshipId)) : ({ isSuccess: false, errorKind: 'not-found' } as const),
  );
  const backToList: BackLinkTarget = { to: '..', relative: 'path', label: texts.detail.backToList };
  const loaded = queryState.status === 'loaded' ? queryState.value : null;

  return (
    <div className={styles.page}>
      <ToolPageHeader name={loaded?.name ?? messages.tools.manageChampionships.name} description={loaded ? texts.detail.subtitle : ''} backLink={backToList} />
      <ServerQueryStatus queryState={queryState} loadingText={texts.detail.loading} onRetry={reload} />
      {loaded && <ChampionshipEditor savedChampionship={loaded} onSaved={replaceValue} />}
    </div>
  );
}
