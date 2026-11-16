import type { SavedCrew } from '@shared/crewRules';
import { type ReactNode, useId, useState } from 'react';
import { getTabPanelProps, Tabs } from '@/components/ui/Tabs/Tabs';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import type { RaceDraftState } from '../../hooks/useRaceDraft';
import { RacePenalties } from '../../penalties/components/RacePenalties/RacePenalties';
import { DriverSwapTables } from '../DriverSwapTables/DriverSwapTables';
import { RaceInfoFields } from '../RaceInfoFields/RaceInfoFields';
import { RaceResultsTable } from '../RaceResultsTable/RaceResultsTable';
import styles from './RaceForm.module.css';

export type RaceFormTab = 'info' | 'results' | 'driverSwaps' | 'penalties';

/**
 * Schede di "Gestisci ordini di arrivo" (dettaglio e creazione). I Cambi pilota hanno uno strumento a parte,
 * "Gestisci cambi pilota" dei Commissari Sportivi, che mostra solo quella scheda.
 */
export const RESULTS_TABS: readonly RaceFormTab[] = ['info', 'results', 'penalties'];
export const DRIVER_SWAP_TABS: readonly RaceFormTab[] = ['driverSwaps'];

interface RaceFormProps {
  readonly draft: RaceDraftState;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly isReadOnly: boolean;
  /** Gara salvata (null in creazione): le penalità si aggiungono solo a una gara esistente. */
  readonly raceId: number | null;
  /** Scheda aperta all'inizio (es. Penalità tornando da una penalità). */
  readonly initialTab?: RaceFormTab;
  /** Schede mostrate; con una sola, niente barra delle schede. */
  readonly visibleTabs?: readonly RaceFormTab[];
}

/**
 * Campi di una gara su schede, usati sia in creazione sia nel dettaglio; le schede mostrate restano tutte montate.
 * Anagrafica, Dettagli e Cambi pilota si salvano con la gara (sempre per intero, anche le schede non mostrate,
 * così i dati delle altre schede restano com'erano); le Penalità si salvano una per una.
 */
export function RaceForm({ draft, crewsQuery, isReadOnly, raceId, initialTab, visibleTabs = RESULTS_TABS }: RaceFormProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  const tabsIdPrefix = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [selectedTab, setSelectedTab] = useState<RaceFormTab>(initialTab && visibleTabs.includes(initialTab) ? initialTab : (visibleTabs[0] ?? 'info'));
  const allCrews = crewsQuery.status === 'loaded' ? crewsQuery.value : [];
  const allTabs: { readonly id: RaceFormTab; readonly label: string; readonly hasErrors: boolean }[] = [
    { id: 'info', label: formTexts.infoTab, hasErrors: !isReadOnly && draft.check.hasInfoErrors },
    { id: 'results', label: formTexts.resultsTab, hasErrors: !isReadOnly && draft.check.hasResultsErrors },
    { id: 'driverSwaps', label: messages.races.driverSwaps.tab, hasErrors: !isReadOnly && draft.check.hasDriverSwapErrors },
    { id: 'penalties', label: messages.penalties.tab, hasErrors: false },
  ];
  const tabContent: Record<RaceFormTab, ReactNode> = {
    info: <RaceInfoFields draft={draft} allCrews={allCrews} isReadOnly={isReadOnly} />,
    results: <RaceResultsTable draft={draft} crewsQuery={crewsQuery} isReadOnly={isReadOnly} />,
    driverSwaps: <DriverSwapTables draft={draft} crewsQuery={crewsQuery} isReadOnly={isReadOnly} />,
    penalties: <RacePenalties raceId={raceId} allCrews={allCrews} />,
  };

  return (
    <div className={styles.raceForm}>
      {visibleTabs.length > 1 && (
        <Tabs
          idPrefix={tabsIdPrefix}
          label={messages.tools.manageResults.name}
          tabs={allTabs.filter((tab) => visibleTabs.includes(tab.id))}
          selectedTabId={selectedTab}
          onSelectTab={setSelectedTab}
          errorsLabel={formTexts.tabHasErrors}
        />
      )}
      {visibleTabs.map((tabId) => (
        <div key={tabId} {...(visibleTabs.length > 1 ? getTabPanelProps(tabsIdPrefix, tabId, selectedTab) : {})} className={styles.tabPanel}>
          {tabContent[tabId]}
        </div>
      ))}
    </div>
  );
}
