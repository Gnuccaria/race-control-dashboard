import { ButtonLink } from '@/components/navigation/ButtonLink/ButtonLink';
import { useI18n } from '@/i18n/useI18n';
import styles from './StatusMessage.module.css';

interface StatusMessageProps {
  readonly title: string;
  readonly description: string;
}

/** Messaggio a pagina intera per errori e pagine mancanti, con il rientro alla home. */
export function StatusMessage({ title, description }: StatusMessageProps) {
  const { messages } = useI18n();

  return (
    <div className={styles.statusMessage}>
      <h1 className={styles.statusTitle}>{title}</h1>
      <p className={styles.statusDescription}>{description}</p>
      <ButtonLink to="/">{messages.app.backToHome}</ButtonLink>
    </div>
  );
}
