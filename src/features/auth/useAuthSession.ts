import { useSyncExternalStore } from 'react';
import { getAuthSession, subscribeToAuthSession } from './authSessionStore';

/** Stato corrente della sessione Discord. */
export function useAuthSession() {
  return useSyncExternalStore(subscribeToAuthSession, getAuthSession);
}
