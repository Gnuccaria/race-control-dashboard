import { useState } from 'react';
import { type LoaderFunctionArgs, useLoaderData } from 'react-router';
import { EmptyState } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { getTabPanelProps } from '@/components/ui/Tabs/tabPanelProps';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import { useI18n } from '@/i18n/useI18n';
import { fetchPublicRace, publicRaceReportUrl } from '../api/publicRaces';
import { ClassificationTable } from '../components/ClassificationTable/ClassificationTable';
import { QualifyingTable } from '../components/QualifyingTable/QualifyingTable';
import { RaceDocuments } from '../components/RaceDocuments/RaceDocuments';
import { RaceFacts } from '../components/RaceFacts/RaceFacts';
import { RaceWeather } from '../components/RaceWeather/RaceWeather';
import { RACES_PATH } from '../sitePaths';
import { SitePageError } from './SiteErrorPage';
import styles from './SitePage.module.css';

type RaceTab = 'qualifying' | 'race' | 'weather' | 'documents';
const TABS_ID = 'race-tabs';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const raceId = Number(params.raceId);
  if (!Number.isInteger(raceId) || raceId < 1) throw new Response(null, { status: 404 });
  return { race: await fetchPublicRace(raceId, request.signal) };
}

/**
 * Pagina di una gara, impaginata come le pagine dei risultati dei campionati: in alto il nome della gara con
 * campionato e round e i dati principali (data, tracciato, durata, giri), poi quattro schede: Qualifiche (ordine e
 * tempi Q1 e Q2, come la classifica), Gara (classifica, la scheda iniziale), Meteo (pattern meteo) e Documentazione (briefing,
 * referto di qualifica e referto di gara, da visualizzare nella pagina o scaricare).
 */
export function Component() {
  const { race } = useLoaderData<typeof loader>();
  const { locale, messages } = useI18n();
  const siteTexts = messages.site;
  const tabTexts = siteTexts.raceTabs;
  const classificationTexts = siteTexts.classification;
  const raceTitle = race.name ?? messages.races.raceLabel(race.round, race.championship);
  const [selectedTab, setSelectedTab] = useState<RaceTab>('race');

  return (
    <div className={styles.sitePage}>
      <ToolPageHeader
        name={raceTitle}
        description={siteTexts.raceSubtitle(race.championship, race.round)}
        backLink={{ to: RACES_PATH, label: siteTexts.backToRaces }}
        documentTitle={siteTexts.documentTitle(raceTitle)}
      />
      <RaceFacts race={race} />
      <section className={styles.section} aria-label={tabTexts.label}>
        <Tabs<RaceTab>
          idPrefix={TABS_ID}
          label={tabTexts.label}
          tabs={[
            { id: 'qualifying', label: tabTexts.qualifying },
            { id: 'race', label: tabTexts.race },
            { id: 'weather', label: tabTexts.weather },
            { id: 'documents', label: tabTexts.documents },
          ]}
          selectedTabId={selectedTab}
          onSelectTab={setSelectedTab}
          errorsLabel=""
        />
        <div {...getTabPanelProps(TABS_ID, 'qualifying', selectedTab)}>
          {race.qualifying && race.qualifying.length > 0 ? (
            <QualifyingTable results={race.qualifying} />
          ) : (
            <EmptyState title={siteTexts.qualifying.empty} />
          )}
        </div>
        <div {...getTabPanelProps(TABS_ID, 'race', selectedTab)}>
          {race.results.length > 0 ? <ClassificationTable results={race.results} /> : <EmptyState title={classificationTexts.empty} />}
        </div>
        <div {...getTabPanelProps(TABS_ID, 'weather', selectedTab)}>
          <RaceWeather weather={race.weather} />
        </div>
        <div {...getTabPanelProps(TABS_ID, 'documents', selectedTab)}>
          <RaceDocuments raceTitle={raceTitle} raceReportUrl={publicRaceReportUrl(race.id, locale)} />
        </div>
      </section>
    </div>
  );
}

export const ErrorBoundary = SitePageError;
