import type { ReactNode } from 'react';
import { LoginPage } from './components/LoginPage/LoginPage';
import { SessionSplash } from './components/SessionSplash/SessionSplash';
import { useAuthSession } from './useAuthSession';

interface AuthGateProps {
  /** Contenuto riservato agli utenti autenticati con il ruolo richiesto. */
  readonly children: ReactNode;
}

/** Mostra il login finché l'utente non è entrato; poi l'applicazione. */
export function AuthGate({ children }: AuthGateProps) {
  const authSession = useAuthSession();

  if (authSession.status === 'restoring') return <SessionSplash />;
  if (authSession.status !== 'signed-in') return <LoginPage />;
  return children;
}
