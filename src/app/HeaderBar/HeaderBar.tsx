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
      {/* Campanella dei ticket di disconnessione accanto al profilo: solo per la Direzione Gara, che li gestisce. */}
      <div className={styles.headerActions}>
        {currentUser.access.raceControl && <NotificationBell />}
        <UserMenu />
      </div>
    </BrandHeader>
  );
}
