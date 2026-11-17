import type { SiteProtest } from '@shared/protestRules';
import { fetchMyProtests } from '../api/protests';
import { createSiteNotificationStore, type SiteItemsState } from '../notifications/createSiteNotificationStore';

/**
 * Proteste di chi è entrato nel sito e del suo equipaggio (logica in createSiteNotificationStore): una protesta
 * respinta dai Commissari e non ancora vista è una notifica della campanella.
 */
const siteProtestStore = createSiteNotificationStore<SiteProtest>({
  seenKeyPrefix: 'site-protest-rejections-seen:',
  fetchItems: fetchMyProtests,
  isNotification: (protest) => protest.status === 'rejected',
});

export type SiteProtestState = SiteItemsState<SiteProtest>;

export const refreshSiteProtests = siteProtestStore.refresh;
export const startSiteProtestPolling = siteProtestStore.startPolling;
export const unseenRejections = siteProtestStore.unseen;
export const markRejectionsSeen = siteProtestStore.markSeen;
export const clearSiteProtests = siteProtestStore.clear;
export const useSiteProtests = siteProtestStore.useState;
