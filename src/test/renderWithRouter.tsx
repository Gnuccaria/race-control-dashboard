import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { LocaleDocumentSync } from '@/app/LocaleDocumentSync/LocaleDocumentSync';
import { appRoutes } from '@/app/router';
import { replaceAuthSessionForTests } from '@/features/auth/authSessionStore';

/** Utente Discord fittizio con il ruolo richiesto. */
export const TEST_USER = {
  id: '80351110224678912',
  username: 'niko_99',
  displayName: 'Niko',
  avatarUrl: 'https://cdn.discordapp.com/embed/avatars/5.png',
  // Organizzazione, Direttore Gara e Commissario: vede tutte le sezioni.
  access: { organization: true, raceControl: true, stewards: true },
} as const;

export function signInTestUser() {
  replaceAuthSessionForTests({ status: 'signed-in', user: TEST_USER });
}

/** Monta l'intera applicazione in memoria con un utente già autenticato, partendo dall'URL indicato (come App, con la lingua su <html>). */
export function renderApp(initialPath = '/') {
  signInTestUser();
  const memoryRouter = createMemoryRouter(appRoutes, { initialEntries: [initialPath] });
  return {
    memoryRouter,
    ...render(
      <>
        <LocaleDocumentSync />
        <RouterProvider router={memoryRouter} />
      </>,
    ),
  };
}

/** Monta un singolo componente che usa Link o altri hook del router. */
export function renderWithRouter(element: ReactNode) {
  const singleRoute: RouteObject[] = [{ path: '/', element }];
  return render(<RouterProvider router={createMemoryRouter(singleRoute)} />);
}
