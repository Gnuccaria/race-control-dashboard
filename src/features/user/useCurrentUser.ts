import type { UserProfile } from '@/features/auth/model/discordProfile';
import { useAuthSession } from '@/features/auth/useAuthSession';

/**
 * Utente Discord autenticato. Va usato solo dentro l'app protetta da AuthGate,
 * dove un utente con il ruolo richiesto è sempre presente.
 */
export function useCurrentUser(): UserProfile {
  const authSession = useAuthSession();
  if (authSession.status !== 'signed-in') {
    throw new Error('useCurrentUser va usato solo dopo il login (dentro AuthGate).');
  }
  return authSession.user;
}
