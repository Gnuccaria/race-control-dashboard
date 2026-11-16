import { type LoaderFunctionArgs, type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';
import { EmptyState } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { RaceBrowser } from '@/features/race-results/components/RaceBrowser/RaceBrowser';
import type { RaceSortColumn } from '@/features/race-results/model/raceList';
import { useI18n } from '@/i18n/useI18n';
import { fetchPublicRaces } from '../api/publicRaces';
import { useRaceListSearchParams } from '../hooks/useRaceListSearchParams';
import { raceResultsPath } from '../sitePaths';
import { SitePageError } from './SiteErrorPage';
import styles from './SitePage.module.css';

/** Nel sito la data viene prima e "Ultima modifica" non serve. */
const SITE_RACE_COLUMNS: readonly RaceSortColumn[] = ['raceDate', 'championship', 'round', 'name', 'track'];

export async function loader({ request }: LoaderFunctionArgs) {
  return { races: await fetchPublicRaces(request.signal) };
}

/** I filtri cambiano solo la parte dopo "?" dell'indirizzo: le gare già lette bastano, niente nuova richiesta. */
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const isOnlySearchChange = currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search;
  return !isOnlySearchChange && defaultShouldRevalidate;
}

/** Elenco delle gare disputate con gli stessi filtri dell'app; la freccia a destra apre la classifica. */
export function Component() {
  const { races } = useLoaderData<typeof loader>();
  const { filters, setFilters, sort, toggleSort } = useRaceListSearchParams();
  const { messages } = useI18n();
  const siteTexts = messages.site;

  return (
    <div className={styles.sitePage}>
      <ToolPageHeader
        name={siteTexts.racesTitle}
        description={siteTexts.racesDescription}
        backLink={{ to: '/', label: siteTexts.backToHome }}
        documentTitle={siteTexts.documentTitle(siteTexts.racesTitle)}
      />
      {races.length === 0 ? (
        <EmptyState title={siteTexts.emptyTitle} description={siteTexts.emptyDescription} />
      ) : (
        <RaceBrowser
          races={races}
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSort={toggleSort}
          columns={SITE_RACE_COLUMNS}
          detailPath={(race) => raceResultsPath(race.id)}
        />
      )}
    </div>
  );
}

export const ErrorBoundary = SitePageError;
