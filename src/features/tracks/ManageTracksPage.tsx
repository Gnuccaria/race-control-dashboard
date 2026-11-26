import { ServerQueryStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { Panel } from '@/components/ui/Panel/Panel';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { TrackRefreshPanel } from './components/TrackRefreshPanel';
import { TrackTable } from './components/TrackTable';
import styles from './ManageTracksPage.module.css';
import { fetchTracks } from './trackApi';

/** Schermata "Gestisci tracciati": aggiornamento dai siti (con anteprima) e tabella dei tracciati salvati. */
export function ManageTracksPage() {
  const { messages } = useI18n();
  const { queryState, reload } = useServerQuery('tracks', fetchTracks);

  return (
    <div className={styles.page}>
      <ToolPageHeader name={messages.tools.manageTracks.name} description={messages.tools.manageTracks.description} />
      <TrackRefreshPanel onSaved={reload} />
      <Panel title={messages.manageTracks.manage.title}>
        <ServerQueryStatus queryState={queryState} loadingText={messages.manageTracks.loading} onRetry={reload} />
        {queryState.status === 'loaded' && <TrackTable tracks={queryState.value} />}
      </Panel>
    </div>
  );
}
