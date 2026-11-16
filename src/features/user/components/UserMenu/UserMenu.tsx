import { useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button } from '@/components/ui/Button/Button';
import { signOut } from '@/features/auth/authSessionStore';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUser } from '../../useCurrentUser';
import styles from '../PreferencesMenu/PreferencesMenu.module.css';
import { PreferencesMenu } from '../PreferencesMenu/PreferencesMenu';

/** Menu utente dell'app: profilo Discord, modalità notte, lingua e uscita (con conferma in una finestra modale). */
export function UserMenu() {
  const currentUser = useCurrentUser();
  const { messages } = useI18n();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const userMenuTexts = messages.userMenu;

  return (
    <PreferencesMenu
      trigger={<Avatar imageUrl={currentUser.avatarUrl} />}
      triggerLabel={userMenuTexts.openMenu(currentUser.displayName)}
      header={
        <div className={styles.userIdentity}>
          <Avatar imageUrl={currentUser.avatarUrl} size="medium" />
          <div className={styles.userNames}>
            <p className={styles.displayName}>{currentUser.displayName}</p>
            <p className={styles.username}>@{currentUser.username}</p>
          </div>
        </div>
      }
      footer={
        <div className={styles.signOutArea}>
          <Button
            variant="danger"
            onClick={() => {
              setIsSignOutDialogOpen(true);
            }}
          >
            {userMenuTexts.signOut}
          </Button>
        </div>
      }
    >
      <ConfirmDialog
        isOpen={isSignOutDialogOpen}
        title={userMenuTexts.signOutConfirmTitle}
        description={userMenuTexts.signOutConfirmDescription}
        confirmLabel={userMenuTexts.confirmSignOut}
        cancelLabel={userMenuTexts.keepSignedIn}
        onConfirm={() => {
          setIsSignOutDialogOpen(false);
          void signOut();
        }}
        onCancel={() => {
          setIsSignOutDialogOpen(false);
        }}
      />
    </PreferencesMenu>
  );
}
