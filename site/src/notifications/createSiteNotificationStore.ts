import { useSyncExternalStore } from 'react';
import { endExpiredSiteSession, getFreshSiteAccessToken } from '../auth/siteAuthStore';

/**
 * Elenco letto dal server per chi è entrato nel sito (i suoi ticket, le sue proteste), riletto ogni 10 secondi
 * (e subito quando la scheda torna in primo piano) finché è aperta una pagina che lo usa. Serve alla campanella:
 * un elemento "da notificare" (es. ticket gestito) è una notifica non letta finché non la si clicca; le notifiche
 * lette si ricordano una per una, per account, in questo browser, ognuno con la sua chiave.
 */

const POLL_INTERVAL_MS = 10_000;
const MAX_SEEN_IDS = 200;

export interface SiteItemsState<Item> {
  readonly items: readonly Item[];
  readonly status: 'idle' | 'ready' | 'error';
  /** Elementi di cui si è già vista la notifica. */
  readonly seenIds: ReadonlySet<number>;
}

type SiteFetchResult<Item> = { readonly isSuccess: true; readonly value: Item[] } | { readonly isSuccess: false; readonly problem: string };

interface SiteNotificationStoreOptions<Item> {
  /** Prefisso della chiave in localStorage, seguito dall'id Discord dell'account. */
  readonly seenKeyPrefix: string;
  readonly fetchItems: (accessToken: string) => Promise<SiteFetchResult<Item>>;
  /** Quali elementi sono notifiche (es. ticket gestito, protesta respinta). */
  readonly isNotification: (item: Item) => boolean;
}

export function createSiteNotificationStore<Item extends { readonly id: number }>({ seenKeyPrefix, fetchItems, isNotification }: SiteNotificationStoreOptions<Item>) {
  const emptyState: SiteItemsState<Item> = { items: [], status: 'idle', seenIds: new Set() };
  let state = emptyState;
  let accountId: string | null = null;
  const listeners = new Set<() => void>();
  let pollerCount = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const setState = (nextState: SiteItemsState<Item>) => {
    state = nextState;
    for (const listener of listeners) listener();
  };

  function readSeen(userId: string): Set<number> {
    try {
      const stored = JSON.parse(localStorage.getItem(`${seenKeyPrefix}${userId}`) ?? '[]') as unknown;
      return new Set(Array.isArray(stored) ? stored.filter((id): id is number => typeof id === 'number') : []);
    } catch {
      return new Set();
    }
  }

  function writeSeen(userId: string, ids: ReadonlySet<number>) {
    try {
      localStorage.setItem(`${seenKeyPrefix}${userId}`, JSON.stringify([...ids].slice(-MAX_SEEN_IDS)));
    } catch {
      // Archiviazione non disponibile: le notifiche si azzerano solo per questa visita.
    }
  }

  /** Rilegge l'elenco; userId è l'account entrato (cambia account → altre notifiche viste). */
  async function refresh(userId: string): Promise<void> {
    if (accountId !== userId) {
      accountId = userId;
      setState({ ...emptyState, seenIds: readSeen(userId) });
    }
    const accessToken = await getFreshSiteAccessToken();
    if (!accessToken) return;
    const result = await fetchItems(accessToken);
    if (accountId !== userId) return;
    if (result.isSuccess) setState({ ...state, items: result.value, status: 'ready' });
    else {
      if (result.problem === 'signed-out') endExpiredSiteSession();
      setState({ ...state, status: 'error' });
    }
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const getState = () => state;

  return {
    getState,
    refresh,
    /** Avvia le letture periodiche per l'account; restituisce la funzione che le ferma. */
    startPolling(userId: string): () => void {
      pollerCount += 1;
      void refresh(userId);
      const refreshWhenVisible = () => {
        if (document.visibilityState === 'visible') void refresh(userId);
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
    },
    /** Notifiche non lette, nell'ordine dell'elenco (dal più recente). */
    unseen: (itemsState: SiteItemsState<Item>) => itemsState.items.filter((item) => isNotification(item) && !itemsState.seenIds.has(item.id)),
    /** Segna come lette le notifiche di questi elementi (il clic su una notifica: solo quella). */
    markSeen(ids: readonly number[]) {
      if (!accountId || ids.every((id) => state.seenIds.has(id))) return;
      const seenIds = new Set([...state.seenIds, ...ids]);
      writeSeen(accountId, seenIds);
      setState({ ...state, seenIds });
    },
    /** All'uscita dall'account. */
    clear() {
      accountId = null;
      setState(emptyState);
    },
    useState: (): SiteItemsState<Item> => useSyncExternalStore(subscribe, getState),
  };
}
