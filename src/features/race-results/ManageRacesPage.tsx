import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { ButtonLink } from '@/components/navigation/ButtonLink/ButtonLink';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import styles from './ManageRacesPage.module.css';
import { RaceList } from './components/RaceList/RaceList';
import { fetchRaces } from './services/raceApi';

/** Schermata "Gestisci ordini di arrivo": le gare più recenti, con filtri, selezione ed eliminazione. */
export function ManageRacesPage() {
  const { messages } = useI18n();
  const { queryState, reload } = useServerQuery('races', fetchRaces);

  return (
    <div className={styles.manageRacesPage}>
      <ToolPageHeader name={messages.tools.manageResults.name} description={messages.tools.manageResults.description} />
      <div className={styles.toolbar}>
        {/* Relativo all'URL corrente: …/ordini-di-arrivo → …/ordini-di-arrivo/nuova */}
        <ButtonLink to="nuova" relative="path">
          {messages.races.list.createRace}
        </ButtonLink>
      </div>
      {queryState.status === 'loading' && <LoadingStatus>{messages.races.list.loading}</LoadingStatus>}
      {queryState.status === 'failed' && (
        <LoadError message={messages.serverErrors[queryState.errorKind]} retryLabel={messages.crews.list.retry} onRetry={reload} />
      )}
      {queryState.status === 'loaded' && <RaceList races={queryState.value} onRacesDeleted={reload} />}
    </div>
  );
}
