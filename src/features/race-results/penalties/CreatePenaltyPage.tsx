import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import styles from '../RacePage.module.css';
import { CreatePenaltyForm } from './components/CreatePenaltyForm/CreatePenaltyForm';
import { BACK_TO_RACE_PENALTIES, usePenaltyRace } from './hooks/usePenaltyRace';
import { useRaceTitle } from './hooks/useRaceTitle';

/** Schermata "Nuova penalità" (…/ordini-di-arrivo/:raceId/penalita/nuova). */
export function CreatePenaltyPage() {
  const { messages } = useI18n();
  const texts = messages.penalties;
  const { raceId, raceQuery, crewsQuery, race, championshipCrews, reprimandCountsBefore } = usePenaltyRace();
  const raceTitle = useRaceTitle(race);
  const failedQuery = raceQuery.queryState.status === 'failed' ? raceQuery.queryState : crewsQuery.status === 'failed' ? crewsQuery : null;

  return (
    <div className={styles.racePage}>
      <ToolPageHeader
        name={texts.create.title}
        description={raceTitle}
        backLink={{ to: BACK_TO_RACE_PENALTIES, relative: 'path', label: texts.backToRace }}
      />
      {failedQuery && <LoadError message={messages.serverErrors[failedQuery.errorKind]} retryLabel={messages.crews.list.retry} onRetry={raceQuery.reload} />}
      {!failedQuery && (raceId === null || !championshipCrews) && <LoadingStatus>{texts.loading}</LoadingStatus>}
      {raceId !== null && championshipCrews && (
        <Panel title={texts.create.panelTitle} description={texts.create.panelDescription}>
          <CreatePenaltyForm raceId={raceId} crews={championshipCrews} reprimandCountsBefore={reprimandCountsBefore} />
        </Panel>
      )}
    </div>
  );
}
