import type { SiteDisconnectionTicket } from '@shared/disconnectionTicketRules';
import { useSyncExternalStore } from 'react';
import { fetchMyTickets } from '../api/disconnectionTickets';
import { endExpiredSiteSession, getFreshSiteAccessToken } from '../auth/siteAuthStore';

/**
 * Ticket mandati da chi è entrato nel sito, riletti ogni 30 secondi (e quando la scheda torna in primo piano)
 * finché è aperta una pagina che li usa. Servono alla campanella: un ticket gestito e non ancora visto è una
 * notifica. I ticket già visti si ricordano per account in questo browser.
 */

const POLL_INTERVAL_MS = 30_000;
const SEEN_KEY_PREFIX = 'site-ticket-results-seen:';
const MAX_SEEN_IDS = 200;

export interface SiteTicketState {
  readonly tickets: readonly SiteDisconnectionTicket[];
  readonly status: 'idle' | 'ready' | 'error';
  /** Ticket gestiti di cui si è già vista la notifica. */
  readonly seenResultIds: ReadonlySet<number>;
}

let state: SiteTicketState = { tickets: [], status: 'idle', seenResultIds: new Set() };
let accountId: string | null = null;
const listeners = new Set<() => void>();
let pollerCount = 0;
let timer: ReturnType<typeof setInterval> | null = null;

const setState = (nextState: SiteTicketState) => {
  state = nextState;
  for (const listener of listeners) listener();
};

function readSeen(userId: string): Set<number> {
  try {
    const stored = JSON.parse(localStorage.getItem(`${SEEN_KEY_PREFIX}${userId}`) ?? '[]') as unknown;
    return new Set(Array.isArray(stored) ? stored.filter((id): id is number => typeof id === 'number') : []);
  } catch {
    return new Set();
  }
}

function writeSeen(userId: string, ids: ReadonlySet<number>) {
  try {
    localStorage.setItem(`${SEEN_KEY_PREFIX}${userId}`, JSON.stringify([...ids].slice(-MAX_SEEN_IDS)));
  } catch {
    // Archiviazione non disponibile: le notifiche si azzerano solo per questa visita.
  }
}

/** Rilegge i ticket; userId è l'account entrato (cambia account → altre notifiche viste). */
export async function refreshSiteTickets(userId: string): Promise<void> {
  if (accountId !== userId) {
    accountId = userId;
    setState({ tickets: [], status: 'idle', seenResultIds: readSeen(userId) });
  }
  const accessToken = await getFreshSiteAccessToken();
  if (!accessToken) return;
  const result = await fetchMyTickets(accessToken);
  if (accountId !== userId) return;
  if (result.isSuccess) setState({ ...state, tickets: result.value, status: 'ready' });
  else {
    if (result.problem === 'signed-out') endExpiredSiteSession();
    setState({ ...state, status: 'error' });
  }
}

/** Avvia le letture periodiche per l'account; restituisce la funzione che le ferma. */
export function startSiteTicketPolling(userId: string): () => void {
  pollerCount += 1;
  void refreshSiteTickets(userId);
  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') void refreshSiteTickets(userId);
  };
  if (pollerCount === 1) timer = setInterval(refreshWhenVisible, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  return () => {
    pollerCount -= 1;
    document.removeEventListener('visibilitychange', refreshWhenVisible);
    if (pollerCount === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Ticket gestiti di cui non si è ancora vista la notifica, dal più recente. */
export const unseenResults = (ticketState: SiteTicketState) =>
  ticketState.tickets.filter((ticket) => ticket.status === 'resolved' && !ticketState.seenResultIds.has(ticket.id));

/** Segna come viste le notifiche di questi ticket. */
export function markResultsSeen(ticketIds: readonly number[]) {
  if (!accountId || ticketIds.every((id) => state.seenResultIds.has(id))) return;
  const seenResultIds = new Set([...state.seenResultIds, ...ticketIds]);
  writeSeen(accountId, seenResultIds);
  setState({ ...state, seenResultIds });
}

/** All'uscita dall'account. */
export function clearSiteTickets() {
  accountId = null;
  setState({ tickets: [], status: 'idle', seenResultIds: new Set() });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSiteTickets = (): SiteTicketState => useSyncExternalStore(subscribe, () => state);
