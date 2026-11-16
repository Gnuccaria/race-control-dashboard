import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { violationLabel } from './model/violationLabel';
import styles from '../RacePage.module.css';
import { EnglishTranslationPanel } from './components/EnglishTranslationPanel/EnglishTranslationPanel';
import { PenaltyEditor } from './components/PenaltyEditor/PenaltyEditor';
import { BACK_TO_RACE_PENALTIES, usePenaltyRace } from './hooks/usePenaltyRace';
import { useRaceTitle } from './hooks/useRaceTitle';
import { fetchPenalty } from './services/penaltyApi';

/** Dettaglio di una penalità (…/ordini-di-arrivo/:raceId/penalita/:penaltyId). */
export function PenaltyDetailPage() {
  const { messages } = useI18n();
  const texts = messages.penalties;
  const { raceId, penaltyId, raceQuery, crewsQuery, race, championshipCrews, reprimandCountsBefore } = usePenaltyRace();
  const raceTitle = useRaceTitle(race);
  const penaltyQuery = useServerQuery(`race-${raceId}-penalty-${penaltyId}`, async () =>
    raceId === null || penaltyId === null ? ({ isSuccess: false, errorKind: 'not-found' } as const) : fetchPenalty(raceId, penaltyId),
  );
  const penalty = penaltyQuery.queryState.status === 'loaded' ? penaltyQuery.queryState.value : null;
  const failedQuery = [penaltyQuery.queryState, raceQuery.queryState, crewsQuery].find((queryState) => queryState.status === 'failed');

  return (
    <div className={styles.racePage}>
      <ToolPageHeader
        name={penalty ? violationLabel(penalty, messages) : texts.detail.title}
        description={raceTitle}
        backLink={{ to: BACK_TO_RACE_PENALTIES, relative: 'path', label: texts.backToRace }}
      />
      {failedQuery?.status === 'failed' && (
        <LoadError
          message={messages.serverErrors[failedQuery.errorKind]}
          retryLabel={messages.crews.list.retry}
          onRetry={() => {
            penaltyQuery.reload();
            raceQuery.reload();
          }}
        />
      )}
      {!failedQuery && (!penalty || !championshipCrews) && <LoadingStatus>{texts.detail.loading}</LoadingStatus>}
      {penalty && championshipCrews && (
        <>
          <PenaltyEditor savedPenalty={penalty} crews={championshipCrews} reprimandCountsBefore={reprimandCountsBefore} onSaved={penaltyQuery.replaceValue} />
          <EnglishTranslationPanel savedPenalty={penalty} onSaved={penaltyQuery.replaceValue} />
        </>
      )}
    </div>
  );
}
