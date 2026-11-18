import { useParams } from 'react-router';
import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { fetchRace } from '@/features/race-results/services/raceApi';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { formatIsoDate } from '@/lib/dateFormatting';
import { serverErrorText } from '@/services/serverErrorText';
import { WeatherPatternEditor } from './components/WeatherPatternEditor';
import { fetchRaceWeather } from './services/weatherApi';
import styles from './Weather.module.css';

const RACE_ID_PATTERN = /^\d{1,9}$/;

/** Pattern meteo di una gara (…/pattern-meteo/:raceId): qualifica (2 slot) e una riga per stint (9 slot). */
export function WeatherDetailPage() {
  const { locale, messages } = useI18n();
  const { raceId = '' } = useParams();
  const isValidRaceId = RACE_ID_PATTERN.test(raceId);
  const notFound = { isSuccess: false, errorKind: 'not-found' } as const;
  const raceQuery = useServerQuery(`race-${raceId}`, async () => (isValidRaceId ? fetchRace(Number(raceId)) : notFound));
  const weatherQuery = useServerQuery(`weather-${raceId}`, async () => (isValidRaceId ? fetchRaceWeather(Number(raceId)) : notFound));
  const race = raceQuery.queryState.status === 'loaded' ? raceQuery.queryState.value : null;
  const failed = weatherQuery.queryState.status === 'failed' ? weatherQuery.queryState : raceQuery.queryState.status === 'failed' ? raceQuery.queryState : null;

  return (
    <div className={styles.page}>
      <ToolPageHeader
        name={race ? (race.name ?? messages.races.raceLabel(race.round, race.championship)) : messages.tools.weatherPattern.name}
        description={
          race
            ? [race.name === null ? null : messages.races.raceLabel(race.round, race.championship), messages.races.detail.subtitle(formatIsoDate(race.raceDate, locale))]
                .filter(Boolean)
                .join('. ')
            : ''
        }
        backLink={{ to: '..', relative: 'path', label: messages.races.detail.backToList }}
      />
      {failed && (
        <LoadError
          message={serverErrorText(messages, failed.errorKind)}
          retryLabel={messages.crews.list.retry}
          onRetry={() => {
            raceQuery.reload();
            weatherQuery.reload();
          }}
        />
      )}
      {!failed && weatherQuery.queryState.status === 'loading' && <LoadingStatus>{messages.weather.loading}</LoadingStatus>}
      {weatherQuery.queryState.status === 'loaded' && (
        <WeatherPatternEditor raceId={Number(raceId)} weather={weatherQuery.queryState.value} onSaved={weatherQuery.replaceValue} />
      )}
    </div>
  );
}
