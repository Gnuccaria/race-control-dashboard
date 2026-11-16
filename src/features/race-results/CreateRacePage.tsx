import { fetchCrews } from '@/features/crews/services/crewApi';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { Panel } from '@/components/ui/Panel/Panel';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import styles from './RacePage.module.css';
import { CreateRaceForm } from './components/CreateRaceForm/CreateRaceForm';

/** Schermata "Nuova gara" (…/ordini-di-arrivo/nuova). */
export function CreateRacePage() {
  const { messages } = useI18n();
  const raceTexts = messages.races;
  // Gli equipaggi servono ai menu dell'ordine di arrivo, filtrati per campionato.
  const { queryState: crewsQuery } = useServerQuery('crews', fetchCrews);

  return (
    <div className={styles.racePage}>
      <ToolPageHeader
        name={raceTexts.create.title}
        description={raceTexts.create.description}
        backLink={{ to: '..', relative: 'path', label: raceTexts.detail.backToList }}
      />
      <Panel title={raceTexts.create.panelTitle} description={raceTexts.create.panelDescription}>
        <CreateRaceForm crewsQuery={crewsQuery} />
      </Panel>
    </div>
  );
}
