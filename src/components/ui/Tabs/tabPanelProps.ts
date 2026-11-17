const tabElementId = (idPrefix: string, tabId: string) => `${idPrefix}-tab-${tabId}`;
const panelElementId = (idPrefix: string, tabId: string) => `${idPrefix}-panel-${tabId}`;

/** Id della scheda e del pannello che controlla, collegati tra loro con lo stesso prefisso. */
export const getTabElementIds = (idPrefix: string, tabId: string) => ({
  tabId: tabElementId(idPrefix, tabId),
  panelId: panelElementId(idPrefix, tabId),
});

/** Attributi del pannello di una scheda: resta montato (i campi non perdono i valori), ma nascosto. */
export const getTabPanelProps = (idPrefix: string, tabId: string, selectedTabId: string) => ({
  id: panelElementId(idPrefix, tabId),
  role: 'tabpanel' as const,
  'aria-labelledby': tabElementId(idPrefix, tabId),
  hidden: tabId !== selectedTabId,
});
