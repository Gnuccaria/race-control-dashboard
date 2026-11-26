import { ServerQueryStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import styles from './Championships.module.css';
import { ChampionshipList } from './components/ChampionshipList/ChampionshipList';
import { fetchChampionships } from './services/championshipApi';

/** Schermata "Gestisci campionato": tutti i campionati, con il dettaglio modificabile ed eliminazione col clic destro. */
export function ManageChampionshipsPage() {
  const { messages } = useI18n();
  const { queryState, reload } = useServerQuery('championships', fetchChampionships);

  return (
    <div className={styles.page}>
      <ToolPageHeader name={messages.tools.manageChampionships.name} description={messages.tools.manageChampionships.description} />
      <ServerQueryStatus queryState={queryState} loadingText={messages.championships.list.loading} onRetry={reload} />
      {queryState.status === 'loaded' && <ChampionshipList championships={queryState.value} onChampionshipsDeleted={reload} />}
    </div>
  );
}
