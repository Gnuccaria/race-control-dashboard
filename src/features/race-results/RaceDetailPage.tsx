import { useLocation, useParams } from 'react-router';
import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { fetchCrews } from '@/features/crews/services/crewApi';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { formatIsoDate } from '@/lib/dateFormatting';
import styles from './RacePage.module.css';
import { RaceEditor } from './components/RaceEditor/RaceEditor';
import { DRIVER_SWAP_TABS, RESULTS_TABS } from './components/RaceForm/raceFormTabs';
import type { NewRaceLocationState } from './hooks/useCreateRace';
import { fetchRace } from './services/raceApi';
import { serverErrorText } from '@/services/serverErrorText';

const RACE_ID_PATTERN = /^\d{1,9}$/;

/**
 * Dettaglio di una gara. "results" per Gestisci ordini di arrivo (…/ordini-di-arrivo/:raceId: anagrafica e
 * dettagli, con gli orari che aprono e chiudono le proteste), "driverSwaps" per Gestisci cambi pilota dei Commissari (…/cambi-pilota/:raceId: solo i
 * cambi pilota). La gara e il salvataggio sono gli stessi.
 */
function RaceDetail({ mode }: { readonly mode: 'results' | 'driverSwaps' }) {
  const { locale, messages } = useI18n();
  const raceTexts = messages.races;
  const { raceId = '' } = useParams();
  const location = useLocation();
  const isNewRace = (location.state as Partial<NewRaceLocationState> | null)?.isNewRace === true;
  const isValidRaceId = RACE_ID_PATTERN.test(raceId);

  const { queryState, reload, replaceValue } = useServerQuery(`race-${raceId}`, async () =>
    isValidRaceId ? fetchRace(Number(raceId)) : ({ isSuccess: false, errorKind: 'not-found' } as const),
  );
  const { queryState: crewsQuery } = useServerQuery('crews', fetchCrews);
  const loadedRace = queryState.status === 'loaded' ? queryState.value : null;

  return (
    <div className={styles.racePage}>
      <ToolPageHeader
        // Con un nome, il titolo è il nome e round e campionato passano nel sottotitolo.
        name={
          loadedRace
            ? (loadedRace.name ?? raceTexts.raceLabel(loadedRace.round, loadedRace.championship))
            : mode === 'results'
              ? messages.tools.manageResults.name
              : messages.tools.manageDriverSwaps.name
        }
        description={
          loadedRace
            ? [
                loadedRace.name === null ? null : raceTexts.raceLabel(loadedRace.round, loadedRace.championship),
                raceTexts.detail.subtitle(formatIsoDate(loadedRace.raceDate, locale)),
              ]
                .filter(Boolean)
                .join('. ')
            : ''
        }
        backLink={{ to: '..', relative: 'path', label: raceTexts.detail.backToList }}
      />
      {queryState.status === 'loading' && <LoadingStatus>{raceTexts.detail.loading}</LoadingStatus>}
      {queryState.status === 'failed' && (
        <LoadError message={serverErrorText(messages, queryState.errorKind)} retryLabel={messages.crews.list.retry} onRetry={reload} />
      )}
      {loadedRace && (
        <RaceEditor
          savedRace={loadedRace}
          crewsQuery={crewsQuery}
          onSaved={replaceValue}
          isNewRace={isNewRace}
          visibleTabs={mode === 'results' ? RESULTS_TABS : DRIVER_SWAP_TABS}
        />
      )}
    </div>
  );
}

export const RaceDetailPage = () => <RaceDetail mode="results" />;
export const DriverSwapRaceDetailPage = () => <RaceDetail mode="driverSwaps" />;
