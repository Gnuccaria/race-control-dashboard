import { useState } from 'react';
import { type LoaderFunctionArgs, useLoaderData } from 'react-router';
import { EmptyState } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { Button } from '@/components/ui/Button/Button';
import { ButtonAnchor } from '@/components/ui/Button/ButtonAnchor';
import { useI18n } from '@/i18n/useI18n';
import { fetchPublicRace, publicRaceReportUrl } from '../api/publicRaces';
import { ClassificationTable } from '../components/ClassificationTable/ClassificationTable';
import { RaceFacts } from '../components/RaceFacts/RaceFacts';
import { RaceReportViewer } from '../components/RaceReportViewer/RaceReportViewer';
import { RACES_PATH } from '../sitePaths';
import { SitePageError } from './SiteErrorPage';
import styles from './SitePage.module.css';

const REPORT_PANEL_ID = 'race-report';

/**
 * Il browser sa mostrare un PDF dentro la pagina? Falso sui telefoni che non lo fanno (Android, per esempio)
 * e nei browser senza lettore PDF: lì resta solo "Scarica referto".
 */
const canShowPdfInline = () => typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const raceId = Number(params.raceId);
  if (!Number.isInteger(raceId) || raceId < 1) throw new Response(null, { status: 404 });
  return { race: await fetchPublicRace(raceId, request.signal) };
}

/**
 * Classifica di una gara, impaginata come le pagine dei risultati dei campionati: in alto il nome
 * della gara con campionato e round, poi i dati principali (data, tracciato, durata, giri) e la classifica.
 * "Visualizza referto" divide lo spazio a metà: la classifica si stringe a sinistra e a destra compare il PDF;
 * "Scarica referto" salva lo stesso PDF sul dispositivo. Dove i PDF non si possono mostrare in pagina,
 * "Visualizza referto" non compare.
 */
export function Component() {
  const { race } = useLoaderData<typeof loader>();
  const { locale, messages } = useI18n();
  const siteTexts = messages.site;
  const classificationTexts = siteTexts.classification;
  const raceTitle = race.name ?? messages.races.raceLabel(race.round, race.championship);
  const reportUrl = publicRaceReportUrl(race.id, locale);
  const [isReportOpen, setIsReportOpen] = useState(false);
  // Il PDF si carica alla prima apertura e poi resta, così riaprirlo è immediato.
  const [hasOpenedReport, setHasOpenedReport] = useState(false);
  const [canViewReport] = useState(canShowPdfInline);

  return (
    <div className={styles.sitePage}>
      <ToolPageHeader
        name={raceTitle}
        description={siteTexts.raceSubtitle(race.championship, race.round)}
        backLink={{ to: RACES_PATH, label: siteTexts.backToRaces }}
        documentTitle={siteTexts.documentTitle(raceTitle)}
      />
      <RaceFacts race={race} />
      <section className={styles.section} aria-labelledby="classification-title">
        <div className={styles.sectionHeader}>
          <h2 id="classification-title" className={styles.sectionTitle}>
            {classificationTexts.title}
          </h2>
          <div className={styles.reportActions}>
            {canViewReport && (
              <Button
                aria-expanded={isReportOpen}
                aria-controls={REPORT_PANEL_ID}
                onClick={() => {
                  setIsReportOpen((wasOpen) => !wasOpen);
                  setHasOpenedReport(true);
                }}
              >
                {isReportOpen ? classificationTexts.hideReport : classificationTexts.viewReport}
              </Button>
            )}
            {/* Il nome del file arriva dal server (Content-Disposition). */}
            <ButtonAnchor href={reportUrl} download>
              {classificationTexts.downloadReport}
            </ButtonAnchor>
          </div>
        </div>
        <div className={styles.reportLayout} data-report-open={isReportOpen || undefined}>
          <div className={styles.classificationPane}>
            {race.results.length > 0 ? (
              <ClassificationTable results={race.results} />
            ) : (
              <EmptyState title={classificationTexts.empty} />
            )}
          </div>
          {canViewReport && (
            <div id={REPORT_PANEL_ID} className={styles.reportPane} inert={!isReportOpen} aria-hidden={!isReportOpen}>
              {hasOpenedReport && <RaceReportViewer url={reportUrl} title={classificationTexts.reportTitle(raceTitle)} />}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export const ErrorBoundary = SitePageError;
