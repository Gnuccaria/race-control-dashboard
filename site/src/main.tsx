import '@fontsource-variable/saira/wdth.css';
import '@/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyThemePreference, getThemePreference } from '@/features/theme/themePreferenceStore';
import { RouterProvider } from 'react-router/dom';
import { restoreSiteSession } from './auth/siteAuthStore';
import { siteRouter } from './router';

// Lo script in index.html ha già applicato il tema scelto prima del primo disegno; qui si allinea lo stato.
applyThemePreference(getThemePreference());

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root non trovato in index.html');

// Riprende l'accesso con Discord salvato in questo browser (se c'è), mentre la pagina si disegna.
void restoreSiteSession();

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={siteRouter} />
  </StrictMode>,
);
