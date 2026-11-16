import { RouterProvider } from 'react-router/dom';
import { AuthGate } from '@/features/auth/AuthGate';
import { LocaleDocumentSync } from './LocaleDocumentSync/LocaleDocumentSync';
import { appRouter } from './router';

/** Radice dell'applicazione: prima il login con Discord, poi la navigazione tra gli strumenti. */
export function App() {
  return (
    <>
      <LocaleDocumentSync />
      <AuthGate>
        <RouterProvider router={appRouter} />
      </AuthGate>
    </>
  );
}
