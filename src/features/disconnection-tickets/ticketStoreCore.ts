import type { DisconnectionTicket } from '@shared/disconnectionTicketRules';
import type { ServerApiResult } from '@/services/serverApi';

/**
 * Ticket di disconnessione da gestire, condivisi da campanella e calcolatore. Si rileggono dal server ogni
 * 10 secondi finché qualcuno li guarda (campanella sempre presente nella barra in alto) e subito quando la
 * finestra torna in primo piano. Ogni ticket è una notifica non letta finché non si clicca nella campanella:
 * le notifiche lette si ricordano una per una (non "tutte fino a qui").
 * La stessa logica serve alle proteste dei Commissari (protestStore), con un'altra chiave per le lette.
 */

export const TICKET_POLL_INTERVAL_MS = 10_000;
const READ_STORAGE_KEY = 'disconnection-tickets:read-ids';
/** Notifiche lette ricordate al massimo (le più recenti). */
const MAX_READ_IDS = 500;

export interface TicketState<Item = DisconnectionTicket> {
  readonly tickets: readonly Item[];
  readonly status: 'idle' | 'ready' | 'error';
  /** Notifiche già lette (cliccate nella campanella). */
  readonly readIds: ReadonlySet<number>;
}

type TicketFetcher<Item> = () => Promise<ServerApiResult<Item[]>>;

interface SeenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createTicketStore<Item extends { readonly id: number } = DisconnectionTicket>(
  fetchTickets: TicketFetcher<Item>,
  storage: SeenStorage | null,
  readStorageKey = READ_STORAGE_KEY,
) {
  const loadReadIds = (): Set<number> => {
    try {
      const stored = JSON.parse(storage?.getItem(readStorageKey) ?? '[]') as unknown;
      return new Set(Array.isArray(stored) ? stored.filter((id): id is number => typeof id === 'number') : []);
    } catch {
      return new Set();
    }
  };
  let state: TicketState<Item> = { tickets: [], status: 'idle', readIds: loadReadIds() };
  const listeners = new Set<() => void>();
  let pollerCount = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const setState = (nextState: TicketState<Item>) => {
    state = nextState;
    for (const listener of listeners) listener();
  };

  const refresh = async () => {
    const result = await fetchTickets();
    setState(result.isSuccess ? { ...state, tickets: result.value, status: 'ready' } : { ...state, status: 'error' });
  };

  const refreshWhenVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void refresh();
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    /** Avvia le letture periodiche; restituisce la funzione che le ferma (con più chiamanti, si fermano dopo l'ultimo). */
    startPolling() {
      pollerCount += 1;
      if (pollerCount === 1) {
        void refresh();
        timer = setInterval(refreshWhenVisible, TICKET_POLL_INTERVAL_MS);
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refreshWhenVisible);
      }
      return () => {
        pollerCount -= 1;
        if (pollerCount === 0) {
          if (timer) clearInterval(timer);
          timer = null;
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', refreshWhenVisible);
        }
      };
    },
    /** Clic su una notifica nella campanella: diventa letta solo quella. */
    markRead(itemId: number) {
      if (state.readIds.has(itemId)) return;
      const readIds = new Set([...state.readIds, itemId]);
      try {
        storage?.setItem(readStorageKey, JSON.stringify([...readIds].slice(-MAX_READ_IDS)));
      } catch {
        // Archiviazione non disponibile: le notifiche lette valgono solo per questa sessione.
      }
      setState({ ...state, readIds });
    },
    /** Toglie subito un ticket gestito (senza aspettare la prossima lettura). */
    removeTicket(ticketId: number) {
      setState({ ...state, tickets: state.tickets.filter((ticket) => ticket.id !== ticketId) });
    },
  };
}

/** Notifiche non lette: elementi dell'elenco non ancora cliccati nella campanella. */
export const unreadTickets = <Item extends { readonly id: number }>(state: TicketState<Item>) =>
  state.tickets.filter((ticket) => !state.readIds.has(ticket.id));
