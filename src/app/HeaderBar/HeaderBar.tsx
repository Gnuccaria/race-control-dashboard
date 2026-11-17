import { BrandHeader } from '@/components/layout/BrandHeader/BrandHeader';
import { APP_NAME } from '@/config/appConfig';
import { NotificationBell } from '@/features/disconnection-tickets/components/NotificationBell/NotificationBell';
import { UserMenu } from '@/features/user/components/UserMenu/UserMenu';
import { useCurrentUser } from '@/features/user/useCurrentUser';
import styles from './HeaderBar.module.css';

export function HeaderBar() {
  const currentUser = useCurrentUser();
  return (
    <BrandHeader name={APP_NAME}>
      {/* Campanella accanto al profilo: ticket di disconnessione per la Direzione Gara, proteste per i Commissari Sportivi. */}
      <div className={styles.headerActions}>
        {(currentUser.access.raceControl || currentUser.access.stewards) && <NotificationBell access={currentUser.access} />}
        <UserMenu />
      </div>
    </BrandHeader>
  );
}
