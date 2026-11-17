import type { ComponentType } from 'react';
import { createHashRouter, type RouteObject } from 'react-router';
import { HomePage } from '@/features/home/HomePage';
import { getToolRoutePath, type ToolSection, TOOL_SECTIONS } from '@/features/tools/toolCatalog';
import { AppLayout } from './AppLayout/AppLayout';
import { NotFoundPage } from './NotFoundPage/NotFoundPage';
import { RequireAccess } from './RequireAccess';
import { RouteErrorPage } from './RouteErrorPage/RouteErrorPage';

type PageLoader = () => Promise<{ Component: ComponentType }>;

/** Le pagine delle sezioni riservate a un ruolo si aprono solo con quel ruolo (anche scrivendo l'indirizzo). */
function guardedLoader(section: ToolSection, loadPage: PageLoader): PageLoader {
  const { requiredAccess } = section;
  if (!requiredAccess) return loadPage;
  return async () => {
    const { Component: Page } = await loadPage();
    return {
      Component: () => (
        <RequireAccess access={requiredAccess}>
          <Page />
        </RequireAccess>
      ),
    };
  };
}

/** Una rotta per ogni strumento disponibile e per le sue pagine interne, caricate solo quando vengono aperte. */
const toolRoutes: RouteObject[] = TOOL_SECTIONS.flatMap((section) =>
  section.tools.flatMap((tool): RouteObject[] => {
    if (tool.availability.status !== 'available') return [];
    const toolPath = getToolRoutePath(section, tool);
    return [
      { path: toolPath, lazy: guardedLoader(section, tool.availability.loadPage) },
      ...(tool.availability.subPages ?? []).map((subPage) => ({ path: `${toolPath}/${subPage.path}`, lazy: guardedLoader(section, subPage.loadPage) })),
    ];
  }),
);

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    children: [{ index: true, Component: HomePage }, ...toolRoutes, { path: '*', Component: NotFoundPage }],
  },
];

/**
 * Router basato sull'hash (#/strumenti/...): nell'app desktop i file vengono serviti
 * dal pacchetto locale, quindi non esiste un server che risponda per ogni percorso.
 * Così anche il ricaricamento (Ctrl+R) su qualsiasi pagina funziona sempre.
 */
export const appRouter = createHashRouter(appRoutes);
