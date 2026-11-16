import { useSyncExternalStore } from 'react';
import { fetchOpenTickets } from './services/ticketApi';
import { createTicketStore, type TicketState } from './ticketStoreCore';

export { TICKET_POLL_INTERVAL_MS, type TicketState, unseenTickets } from './ticketStoreCore';

/** Ticket da gestire dell'app, letti dal server (logica in ticketStoreCore.ts). */
const browserStorage = typeof localStorage === 'undefined' ? null : localStorage;
export const ticketStore = createTicketStore(fetchOpenTickets, browserStorage);

export const useTicketState = (): TicketState => useSyncExternalStore(ticketStore.subscribe, ticketStore.getState);
