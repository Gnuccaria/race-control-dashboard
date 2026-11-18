import { type KeyboardEvent, useRef } from 'react';
import styles from './Tabs.module.css';
import { getTabElementIds } from './tabPanelProps';

export interface TabDefinition<TabId extends string> {
  readonly id: TabId;
  readonly label: string;
  /** Mostra un segnale di errore sulla scheda (es. un campo non valido al suo interno). */
  readonly hasErrors?: boolean;
  /** Scheda visibile ma non ancora utilizzabile (es. una sezione in costruzione): non si seleziona. */
  readonly isDisabled?: boolean;
}

interface TabsProps<TabId extends string> {
  /** Prefisso degli id: le schede e i pannelli si collegano con getTabPanelProps. */
  readonly idPrefix: string;
  readonly label: string;
  readonly tabs: readonly TabDefinition<TabId>[];
  readonly selectedTabId: TabId;
  readonly onSelectTab: (tabId: TabId) => void;
  /** Testo letto dagli screen reader accanto alle schede con errori. */
  readonly errorsLabel: string;
}


/**
 * Schede secondo il pattern ARIA: una sola scheda raggiungibile con Tab, frecce sinistra/destra
 * (e Home/Fine) per passare alle altre, che si attivano subito.
 */
export function Tabs<TabId extends string>({ idPrefix, label, tabs, selectedTabId, onSelectTab, errorsLabel }: TabsProps<TabId>) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const focusAndSelect = (tabIndex: number, step: number) => {
    // Le schede disattivate si saltano.
    let index = tabIndex;
    for (let attempt = 0; attempt < tabs.length && tabs[(index + tabs.length) % tabs.length]?.isDisabled; attempt += 1) index += step;
    const nextTab = tabs[(index + tabs.length) % tabs.length];
    if (!nextTab || nextTab.isDisabled) return;
    onSelectTab(nextTab.id);
    tabListRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(getTabElementIds(idPrefix, nextTab.id).tabId)}`)?.focus();
  };

  const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const selectedIndex = tabs.findIndex((tab) => tab.id === selectedTabId);
    const moveByKey: Partial<Record<string, readonly [number, number]>> = {
      ArrowRight: [selectedIndex + 1, 1],
      ArrowLeft: [selectedIndex - 1, -1],
      Home: [0, 1],
      End: [tabs.length - 1, -1],
    };
    const move = moveByKey[keyboardEvent.key];
    if (move === undefined) return;
    keyboardEvent.preventDefault();
    focusAndSelect(move[0], move[1]);
  };

  return (
    <div ref={tabListRef} role="tablist" aria-label={label} className={styles.tabList} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const isSelected = tab.id === selectedTabId;
        return (
          <button
            key={tab.id}
            id={getTabElementIds(idPrefix, tab.id).tabId}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={getTabElementIds(idPrefix, tab.id).panelId}
            tabIndex={isSelected ? 0 : -1}
            disabled={tab.isDisabled}
            className={styles.tab}
            onClick={() => {
              onSelectTab(tab.id);
            }}
          >
            {tab.label}
            {tab.hasErrors && (
              <span className={styles.errorMark}>
                <span className={styles.visuallyHidden}>{` (${errorsLabel})`}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
