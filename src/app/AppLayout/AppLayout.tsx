import { Outlet } from 'react-router';
import { PageFrame } from '@/components/layout/PageFrame/PageFrame';
import { HeaderBar } from '../HeaderBar/HeaderBar';
import { SideMenu } from '../SideMenu/SideMenu';

/** Struttura comune a tutte le pagine dell'app: barra con il menu utente, menu laterale delle sezioni e contenuto della rotta. */
export function AppLayout() {
  return (
    <PageFrame header={<HeaderBar />} sideMenu={<SideMenu />}>
      <Outlet />
    </PageFrame>
  );
}
