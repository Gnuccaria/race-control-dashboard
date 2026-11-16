import { isRouteErrorResponse, useParams, useRevalidator, useRouteError } from 'react-router';
import { EmptyState, LoadError } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { useI18n } from '@/i18n/useI18n';
import { SiteFrame } from '../layout/SiteLayout';
import styles from './SitePage.module.css';

/**
 * Errore dentro una pagina: gara inesistente (404) oppure dati non raggiungibili, con "Riprova".
 * Il ritorno all'elenco compare solo nelle pagine delle gare: nell'elenco porterebbe alla pagina stessa.
 */
export function SitePageError() {
  const routeError = useRouteError();
  const isRacePage = useParams().raceId !== undefined;
  const { revalidate } = useRevalidator();
  const { messages } = useI18n();
  const siteTexts = messages.site;
  const isNotFound = isRouteErrorResponse(routeError) && routeError.status === 404;

  return (
    <div className={styles.sitePage}>
      <ToolPageHeader
        name={isNotFound ? siteTexts.raceNotFound : siteTexts.racesTitle}
        description={isNotFound ? siteTexts.raceNotFoundDescription : ''}
        backLink={isRacePage ? { to: '/', label: siteTexts.backToRaces } : null}
        documentTitle={siteTexts.documentTitle(isNotFound ? siteTexts.raceNotFound : siteTexts.racesTitle)}
      />
      {isNotFound ? (
        <EmptyState title={siteTexts.raceNotFound} />
      ) : (
        <LoadError message={siteTexts.loadError} retryLabel={siteTexts.retry} onRetry={() => void revalidate()} />
      )}
    </div>
  );
}

/** Errore fuori dalle pagine (es. pagina inesistente): stessa cornice del sito. */
export function SiteErrorPage() {
  return (
    <SiteFrame>
      <SitePageError />
    </SiteFrame>
  );
}
