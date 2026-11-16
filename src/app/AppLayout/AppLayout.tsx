import { Outlet } from 'react-router';
import { PageFrame } from '@/components/layout/PageFrame/PageFrame';
import { HeaderBar } from '../HeaderBar/HeaderBar';

/** Struttura comune a tutte le pagine dell'app: barra con il menu utente e contenuto della rotta. */
export function AppLayout() {
  return (
    <PageFrame header={<HeaderBar />}>
      <Outlet />
    </PageFrame>
  );
}
