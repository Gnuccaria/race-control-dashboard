import type { SiteDisconnectionTicket } from '@shared/disconnectionTicketRules';
import { fetchMyTickets } from '../api/disconnectionTickets';
import { createSiteNotificationStore, type SiteItemsState } from '../notifications/createSiteNotificationStore';

/**
 * Ticket mandati da chi è entrato nel sito (logica in createSiteNotificationStore): un ticket gestito e non
 * ancora visto è una notifica della campanella.
 */
const siteTicketStore = createSiteNotificationStore<SiteDisconnectionTicket>({
  seenKeyPrefix: 'site-ticket-results-seen:',
  fetchItems: fetchMyTickets,
  isNotification: (ticket) => ticket.status === 'resolved',
});

export type SiteTicketState = SiteItemsState<SiteDisconnectionTicket>;

export const refreshSiteTickets = siteTicketStore.refresh;
export const startSiteTicketPolling = siteTicketStore.startPolling;
export const unseenResults = siteTicketStore.unseen;
export const markResultsSeen = siteTicketStore.markSeen;
export const clearSiteTickets = siteTicketStore.clear;
export const useSiteTickets = siteTicketStore.useState;
