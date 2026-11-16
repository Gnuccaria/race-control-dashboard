import { useState } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { BrandMark } from '@/components/ui/BrandMark/BrandMark';
import { Button } from '@/components/ui/Button/Button';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import { APP_NAME, formatDocumentTitle } from '@/config/appConfig';
import { useI18n } from '@/i18n/useI18n';
import { cancelSignIn, signInWithDiscord } from '../../authSessionStore';
import { useAuthSession } from '../../useAuthSession';
import styles from './LoginPage.module.css';

/** Prima schermata dell'app: l'unico modo per entrare è l'account Discord con il ruolo richiesto. */
export function LoginPage() {
  const authSession = useAuthSession();
  const { messages } = useI18n();
  const [shouldRememberAccess, setShouldRememberAccess] = useState(false);

  const authTexts = messages.auth;
  const isSigningIn = authSession.status === 'signing-in';
  const errorKind = authSession.status === 'signed-out' ? authSession.errorKind : null;

  const startSignIn = () => {
    void signInWithDiscord({
      rememberAccess: shouldRememberAccess,
      browserCompletionPage: {
        title: authTexts.browserCompletedTitle,
        message: authTexts.browserCompletedMessage(APP_NAME),
      },
    });
  };

  const stopSignIn = () => {
    void cancelSignIn();
  };

  return (
    <main className={styles.loginPage}>
      <title>{formatDocumentTitle(authTexts.documentTitle)}</title>
      <div className={styles.loginCard}>
        <BrandMark size="large" />
        <header className={styles.loginHeader}>
          <h1 className={styles.loginTitle}>{APP_NAME}</h1>
          <p className={styles.loginDescription}>{authTexts.description}</p>
        </header>

        {errorKind && <InlineAlert>{authTexts.errors[errorKind]}</InlineAlert>}

        <div className={styles.signInActions}>
          <DiscordSignInButton className={styles.signInButton} disabled={isSigningIn} onClick={startSignIn}>
            {isSigningIn ? authTexts.waitingForDiscord : authTexts.signInWithDiscord}
          </DiscordSignInButton>
          {isSigningIn ? (
            <p className={styles.signInProgress} role="status">
              {authTexts.completeSignInInBrowser}{' '}
              <Button variant="quiet" onClick={stopSignIn}>
                {authTexts.cancelSignIn}
              </Button>
            </p>
          ) : (
            <Checkbox
              label={authTexts.rememberAccess}
              description={authTexts.rememberAccessDescription}
              isChecked={shouldRememberAccess}
              onCheckedChange={setShouldRememberAccess}
            />
          )}
        </div>

        <p className={styles.privacyNote}>{authTexts.privacyNote}</p>
      </div>
    </main>
  );
}
