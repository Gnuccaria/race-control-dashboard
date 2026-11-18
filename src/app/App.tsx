import { RouterProvider } from 'react-router/dom';
import { AuthGate } from '@/features/auth/AuthGate';
import { UpdateGate } from '@/features/updates/UpdateGate';
import { LocaleDocumentSync } from './LocaleDocumentSync/LocaleDocumentSync';
import { appRouter } from './router';

/** Radice dell'applicazione: all'avvio l'eventuale aggiornamento, poi il login con Discord e la navigazione tra gli strumenti. */
export function App() {
  return (
    <>
      <LocaleDocumentSync />
      <UpdateGate>
        <AuthGate>
          <RouterProvider router={appRouter} />
        </AuthGate>
      </UpdateGate>
    </>
  );
}
