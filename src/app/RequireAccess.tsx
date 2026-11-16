import type { ReactNode } from 'react';
import type { AppAccess } from '@/features/auth/model/discordProfile';
import { useCurrentUser } from '@/features/user/useCurrentUser';
import { NotFoundPage } from './NotFoundPage/NotFoundPage';

/** Pagina di una sezione riservata a un ruolo: senza quel ruolo è come se non esistesse. */
export function RequireAccess({ access, children }: { readonly access: keyof AppAccess; readonly children: ReactNode }) {
  const currentUser = useCurrentUser();
  return currentUser.access[access] ? children : <NotFoundPage />;
}
