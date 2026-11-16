import type { DisconnectionTicket } from '@shared/disconnectionTicketRules';
import type { ServerApiResult } from '@/services/serverApi';

/**
 * Ticket di disconnessione da gestire, condivisi da campanella e calcolatore. Si rileggono dal server ogni
 * 20 secondi finché qualcuno li guarda (campanella sempre presente nella barra in alto) e quando la finestra
 * torna in primo piano. I ticket con numero oltre l'ultimo visto sono le notifiche nuove.
 */

export const TICKET_POLL_INTERVAL_MS = 20_000;
const SEEN_STORAGE_KEY = 'disconnection-tickets:seen-up-to';

export interface TicketState {
  readonly tickets: readonly DisconnectionTicket[];
  readonly status: 'idle' | 'ready' | 'error';
  /** Numero dell'ultimo ticket già visto nella tendina delle notifiche. */
  readonly seenUpToId: number;
}

type TicketFetcher = () => Promise<ServerApiResult<DisconnectionTicket[]>>;

interface SeenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createTicketStore(fetchTickets: TicketFetcher, storage: SeenStorage | null) {
  const readSeen = () => {
    try {
      return Number(storage?.getItem(SEEN_STORAGE_KEY) ?? 0) || 0;
    } catch {
      return 0;
    }
  };
  let state: TicketState = { tickets: [], status: 'idle', seenUpToId: readSeen() };
  const listeners = new Set<() => void>();
  let pollerCount = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const setState = (nextState: TicketState) => {
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
    /** Aprendo la tendina delle notifiche, tutti i ticket presenti diventano già visti. */
    markAllSeen() {
      const seenUpToId = Math.max(state.seenUpToId, ...state.tickets.map((ticket) => ticket.id));
      if (seenUpToId === state.seenUpToId) return;
      try {
        storage?.setItem(SEEN_STORAGE_KEY, String(seenUpToId));
      } catch {
        // Archiviazione non disponibile: le notifiche si azzerano solo per questa sessione.
      }
      setState({ ...state, seenUpToId });
    },
    /** Toglie subito un ticket gestito (senza aspettare la prossima lettura). */
    removeTicket(ticketId: number) {
      setState({ ...state, tickets: state.tickets.filter((ticket) => ticket.id !== ticketId) });
    },
  };
}

export const unseenTickets = (state: TicketState) => state.tickets.filter((ticket) => ticket.id > state.seenUpToId);
