import { Avatar, GuestAvatar } from '@/components/ui/Avatar/Avatar';
import { Button } from '@/components/ui/Button/Button';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import menuStyles from '@/features/user/components/PreferencesMenu/PreferencesMenu.module.css';
import { PreferencesMenu } from '@/features/user/components/PreferencesMenu/PreferencesMenu';
import { useI18n } from '@/i18n/useI18n';
import { signInWithDiscord, signOutOfSite, useSiteAuth } from '../auth/siteAuthStore';
import { clearSiteProtests } from '../protests/siteProtestStore';
import { clearSiteTickets } from '../tickets/siteTicketStore';
import { SiteNotificationBell } from './SiteNotificationBell';
import styles from './SiteAccountMenu.module.css';

/**
 * Tendina in alto a destra del sito: accesso con Discord (basta far parte del server della lega), poi nome e
 * handle Discord con "Esci"; sotto, come nell'app, modalità notte e lingua.
 */
export function SiteAccountMenu() {
  const auth = useSiteAuth();
  const { messages } = useI18n();
  const siteTexts = messages.site;
  const accountTexts = siteTexts.account;

  if (auth.status === 'signed-in') {
    const { profile } = auth;
    return (
      <div className={styles.headerActions}>
        <SiteNotificationBell userId={profile.id} />
        <PreferencesMenu
        trigger={<Avatar imageUrl={profile.avatarUrl} />}
        triggerLabel={accountTexts.openMenu(profile.displayName)}
        automaticLanguageLabel={siteTexts.browserLanguage}
        header={
          <div className={menuStyles.userIdentity}>
            <Avatar imageUrl={profile.avatarUrl} size="medium" />
            <div className={menuStyles.userNames}>
              <p className={menuStyles.displayName}>{profile.displayName}</p>
              <p className={menuStyles.username}>@{profile.username}</p>
            </div>
          </div>
        }
        footer={
          <div className={menuStyles.signOutArea}>
            <Button
              variant="danger"
              onClick={() => {
                clearSiteTickets();
                clearSiteProtests();
                void signOutOfSite();
              }}
            >
              {accountTexts.signOut}
            </Button>
          </div>
        }
        />
      </div>
    );
  }

  return (
    <PreferencesMenu
      trigger={<GuestAvatar />}
      triggerLabel={siteTexts.preferencesMenu}
      automaticLanguageLabel={siteTexts.browserLanguage}
      header={
        <div className={styles.signInArea}>
          {auth.status === 'checking' ? (
            <p className={styles.signInHint} role="status">
              {accountTexts.checking}
            </p>
          ) : (
            <>
              <DiscordSignInButton className={styles.signInButton} onClick={() => void signInWithDiscord()}>
                {messages.auth.signInWithDiscord}
              </DiscordSignInButton>
              <p className={styles.signInHint}>{accountTexts.signInHint}</p>
              {auth.errorCode && (
                <p className={styles.signInError} role="alert">
                  {accountTexts.errors[auth.errorCode]}
                </p>
              )}
            </>
          )}
        </div>
      }
    />
  );
}
