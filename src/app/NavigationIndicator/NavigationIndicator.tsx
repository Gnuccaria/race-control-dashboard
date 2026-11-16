import { useNavigation } from 'react-router';
import { useI18n } from '@/i18n/useI18n';
import styles from './NavigationIndicator.module.css';

/** Barra sottile in cima alla pagina mentre si carica lo strumento richiesto. */
export function NavigationIndicator() {
  const { state: navigationState } = useNavigation();
  const { messages } = useI18n();
  if (navigationState === 'idle') return null;

  return <div role="progressbar" aria-label={messages.app.pageLoading} className={styles.navigationIndicator} />;
}
