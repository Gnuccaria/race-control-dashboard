import { BrandMark } from '@/components/ui/BrandMark/BrandMark';
import { useI18n } from '@/i18n/useI18n';
import styles from './SessionSplash.module.css';

/** Mostrata all'avvio mentre si verifica l'accesso ricordato. */
export function SessionSplash() {
  const { messages } = useI18n();

  return (
    <main className={styles.sessionSplash}>
      <BrandMark size="large" />
      <p role="status" className={styles.splashMessage}>
        {messages.auth.verifyingAccess}
      </p>
    </main>
  );
}
