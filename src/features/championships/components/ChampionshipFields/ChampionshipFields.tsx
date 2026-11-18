import { CHAMPIONSHIP_NAME_MAX_LENGTH } from '@shared/championshipRules';
import { useId, useState } from 'react';
import { FormField } from '@/components/form/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Tabs } from '@/components/ui/Tabs/Tabs';
import { getTabPanelProps } from '@/components/ui/Tabs/tabPanelProps';
import { useI18n } from '@/i18n/useI18n';
import type { ChampionshipDraftState } from '../../hooks/useChampionshipDraft';
import { ChampionshipCarsField } from '../ChampionshipCarsField/ChampionshipCarsField';
import { ChampionshipDurationsField } from '../ChampionshipDurationsField/ChampionshipDurationsField';
import { SessionSettingsFields } from '../SessionSettingsFields/SessionSettingsFields';
import { StintScheduleField } from '../StintScheduleField/StintScheduleField';
import styles from './ChampionshipFields.module.css';

interface ChampionshipFieldsProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly?: boolean;
  /** Vetture usate da almeno un equipaggio del campionato (solo nel dettaglio): non si possono togliere. */
  readonly lockedCarIds?: readonly number[];
}

type ChampionshipTabId = 'general' | 'stints' | 'session';

/**
 * Dati del campionato in tre schede, in "Crea campionato" e nel dettaglio: Generale (nome, durate con lo stint,
 * vetture ammesse), Gestione stint (orario di partenza di ogni durata e orari degli stint) e Impostazioni di sessione.
 * Le schede restano montate: passando dall'una all'altra non si perde niente.
 */
export function ChampionshipFields({ draft, isReadOnly = false, lockedCarIds = [] }: ChampionshipFieldsProps) {
  const { messages } = useI18n();
  const texts = messages.championships;
  const idPrefix = useId().replace(/:/g, '');
  const [selectedTabId, setSelectedTabId] = useState<ChampionshipTabId>('general');
  const tabs = [
    { id: 'general' as const, label: texts.tabs.general },
    {
      id: 'stints' as const,
      label: texts.tabs.stints,
      hasErrors: !isReadOnly && draft.scheduledRows.some((row) => row.startTime === ''),
    },
    {
      id: 'session' as const,
      label: texts.tabs.session,
      hasErrors: !isReadOnly && draft.sessionSettingsIssue !== null,
    },
  ];
  const nameError = !isReadOnly && draft.visibleNameIssue && draft.visibleNameIssue !== 'required' ? texts.nameIssues[draft.visibleNameIssue] : undefined;

  return (
    <div className={styles.fields}>
      <Tabs
        idPrefix={idPrefix}
        label={texts.tabs.label}
        tabs={tabs}
        selectedTabId={selectedTabId}
        onSelectTab={setSelectedTabId}
        errorsLabel={texts.tabs.errors}
      />
      <div {...getTabPanelProps(idPrefix, 'general', selectedTabId)} className={styles.fields}>
        <FormField label={texts.name} hint={isReadOnly ? undefined : texts.nameHint} errorMessage={nameError}>
          {({ isInvalid, ...inputAttributes }) => (
            <Input
              {...inputAttributes}
              type="text"
              maxLength={CHAMPIONSHIP_NAME_MAX_LENGTH}
              spellCheck={false}
              readOnly={isReadOnly}
              isInvalid={isInvalid}
              value={draft.values.name}
              onValueChange={draft.changeName}
            />
          )}
        </FormField>
        <ChampionshipDurationsField draft={draft} isReadOnly={isReadOnly} />
        <ChampionshipCarsField draft={draft} isReadOnly={isReadOnly} lockedCarIds={lockedCarIds} />
      </div>
      <div {...getTabPanelProps(idPrefix, 'stints', selectedTabId)}>
        <StintScheduleField draft={draft} isReadOnly={isReadOnly} />
      </div>
      <div {...getTabPanelProps(idPrefix, 'session', selectedTabId)}>
        <SessionSettingsFields draft={draft} isReadOnly={isReadOnly} />
      </div>
    </div>
  );
}
