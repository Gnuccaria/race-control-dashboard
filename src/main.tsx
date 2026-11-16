import '@fontsource-variable/saira/wdth.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { restoreSavedSession } from './features/auth/authSessionStore';
import { applyThemePreference, getThemePreference } from './features/theme/themePreferenceStore';
import './styles/global.css';

// Lo script in index.html ha già colorato la pagina; qui si allinea anche la finestra desktop.
applyThemePreference(getThemePreference());
// Se l'utente aveva scelto "Ricorda l'accesso", rinnova la sessione e ricontrolla il ruolo.
void restoreSavedSession();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root non trovato in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
