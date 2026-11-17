import type { Protest } from '@shared/protestRules';
import { useSyncExternalStore } from 'react';
import { createTicketStore, type TicketState, unreadTickets } from '@/features/disconnection-tickets/ticketStoreCore';
import { fetchProtests } from './services/protestApi';

/**
 * Proteste per la campanella dei Commissari Sportivi: stessa logica dei ticket (lettura ogni 10 secondi,
 * ogni protesta in esame è una notifica finché non la si clicca), con la sua chiave per le notifiche lette.
 */
const browserStorage = typeof localStorage === 'undefined' ? null : localStorage;
export const protestStore = createTicketStore<Protest>(fetchProtests, browserStorage, 'protests:read-ids');

export type ProtestState = TicketState<Protest>;

export const useProtestState = (): ProtestState => useSyncExternalStore(protestStore.subscribe, protestStore.getState);

/** Dettaglio di una protesta in "Gestisci proteste". */
export const protestHref = (protestId: number) => `/commissari/proteste/${protestId}`;

/** Notifiche non lette: proteste ancora in esame non ancora cliccate nella campanella. */
export const unreadProtests = (state: ProtestState) => unreadTickets(state).filter((protest) => protest.status === 'open');
