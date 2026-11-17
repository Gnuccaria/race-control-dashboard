import type { Protest } from '@shared/protestRules';
import { useSyncExternalStore } from 'react';
import { createTicketStore, type TicketState, unseenTickets } from '@/features/disconnection-tickets/ticketStoreCore';
import { fetchProtests } from './services/protestApi';

/**
 * Proteste per la campanella dei Commissari Sportivi: stessa logica dei ticket (lettura ogni 20 secondi,
 * notifiche = proteste con numero oltre l'ultima vista), con la sua chiave per le proteste già viste.
 */
const browserStorage = typeof localStorage === 'undefined' ? null : localStorage;
export const protestStore = createTicketStore<Protest>(fetchProtests, browserStorage, 'protests:seen-up-to');

export type ProtestState = TicketState<Protest>;

export const useProtestState = (): ProtestState => useSyncExternalStore(protestStore.subscribe, protestStore.getState);

/** Dettaglio di una protesta in "Gestisci proteste". */
export const protestHref = (protestId: number) => `/commissari/proteste/${protestId}`;

/** Notifiche: proteste arrivate dopo l'ultima vista e ancora in esame. */
export const unseenProtests = (state: ProtestState) => unseenTickets(state).filter((protest) => protest.status === 'open');
