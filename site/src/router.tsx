import { createBrowserRouter } from 'react-router';
import { SiteLayout } from './layout/SiteLayout';
import { SiteErrorPage } from './pages/SiteErrorPage';
import { SiteLoading } from './pages/SiteLoading';

/**
 * Pagine, caricate su richiesta: home con le card (/), elenco delle gare (/gare), classifica di una gara
 * (/gare/:raceId), ticket di disconnessione (/ticket-disconnessione) e protesta (/protesta), dopo l'accesso con Discord, e ritorno da
 * Discord (/accesso/discord). I dati arrivano dai loader prima del rendering; gli errori dalla pagina d'errore.
 */
export const siteRouter = createBrowserRouter([
  {
    path: '/',
    Component: SiteLayout,
    ErrorBoundary: SiteErrorPage,
    HydrateFallback: SiteLoading,
    children: [
      { index: true, lazy: () => import('./pages/HomePage') },
      { path: 'gare', lazy: () => import('./pages/RacesPage') },
      { path: 'gare/:raceId', lazy: () => import('./pages/RaceResultsPage') },
      { path: 'ticket-disconnessione', lazy: () => import('./pages/DisconnectionTicketPage') },
      { path: 'ticket-disconnessione/:ticketId', lazy: () => import('./pages/DisconnectionTicketDetailPage') },
      { path: 'protesta', lazy: () => import('./pages/ProtestPage') },
      { path: 'protesta/:protestId', lazy: () => import('./pages/ProtestDetailPage') },
      { path: 'accesso/discord', lazy: () => import('./pages/DiscordCallbackPage') },
    ],
  },
]);
