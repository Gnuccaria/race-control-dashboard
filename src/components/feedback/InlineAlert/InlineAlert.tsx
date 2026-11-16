import styles from './InlineAlert.module.css';

interface InlineAlertProps {
  readonly children: string;
  /** error: annunciato subito (role="alert") · success: annunciato con discrezione (role="status"). */
  readonly tone?: 'error' | 'success';
}

/** Messaggio in linea dopo un'azione: errore da correggere o conferma di riuscita. */
export function InlineAlert({ children, tone = 'error' }: InlineAlertProps) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={styles.inlineAlert} data-tone={tone}>
      {children}
    </p>
  );
}
