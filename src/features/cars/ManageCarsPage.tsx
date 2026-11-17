import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { Panel } from '@/components/ui/Panel/Panel';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { fetchCars } from './carApi';
import { CarRefreshPanel } from './components/CarRefreshPanel';
import { CarTable } from './components/CarTable';
import styles from './ManageCarsPage.module.css';

/** Schermata "Gestisci vetture": aggiornamento dai siti (con anteprima) e tabella delle vetture salvate. */
export function ManageCarsPage() {
  const { messages } = useI18n();
  const { queryState, reload } = useServerQuery('cars', fetchCars);

  return (
    <div className={styles.page}>
      <ToolPageHeader name={messages.tools.manageCars.name} description={messages.tools.manageCars.description} />
      <CarRefreshPanel onSaved={reload} />
      <Panel title={messages.cars.manage.title}>
        {queryState.status === 'loading' && <LoadingStatus>{messages.cars.loading}</LoadingStatus>}
        {queryState.status === 'failed' && <LoadError message={messages.serverErrors[queryState.errorKind]} retryLabel={messages.cars.manage.retry} onRetry={reload} />}
        {queryState.status === 'loaded' && <CarTable cars={queryState.value} />}
      </Panel>
    </div>
  );
}
