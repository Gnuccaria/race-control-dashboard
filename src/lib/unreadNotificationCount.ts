import { useSyncExternalStore } from 'react';

/**
 * Numero delle notifiche non lette della campanella (app o sito), per il titolo della scheda/finestra:
 * "(3) Race Control …". Lo aggiorna la campanella; 0 quando non c'è (utente uscito, nessun ruolo).
 */
let unreadCount = 0;
const listeners = new Set<() => void>();

export function setUnreadNotificationCount(count: number) {
  if (count === unreadCount) return;
  unreadCount = count;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useUnreadNotificationCount = (): number => useSyncExternalStore(subscribe, () => unreadCount);

/** "(3) Titolo" con almeno una notifica non letta, altrimenti il titolo così com'è. */
export const withUnreadCount = (title: string, count: number): string => (count > 0 ? `(${count}) ${title}` : title);
