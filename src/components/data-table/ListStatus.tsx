import type { ReactNode } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { serverErrorText } from '@/services/serverErrorText';
import styles from './ListStatus.module.css';

interface LoadingStatusProps {
  readonly children: string;
}

/** Caricamento in corso, annunciato con discrezione agli screen reader. */
export function LoadingStatus({ children }: LoadingStatusProps) {
  return (
    <p role="status" className={styles.loadingStatus}>
      {children}
    </p>
  );
}

interface LoadErrorProps {
  readonly message: string;
  /** Di default «Riprova» (messages.common.retry). */
  readonly retryLabel?: string;
  readonly onRetry: () => void;
}

/** Errore di caricamento con la possibilità di riprovare. */
export function LoadError({ message, retryLabel, onRetry }: LoadErrorProps) {
  const { messages } = useI18n();
  return (
    <div className={styles.loadError}>
      <InlineAlert>{message}</InlineAlert>
      <Button onClick={onRetry}>
        {retryLabel ?? messages.common.retry}
      </Button>
    </div>
  );
}

interface ServerQueryStatusProps {
  readonly queryState: ServerQueryState<unknown>;
  readonly loadingText: string;
  readonly onRetry: () => void;
}

/** Stato di una lettura dal server mentre non è pronta: caricamento in corso, oppure errore con «Riprova». */
export function ServerQueryStatus({ queryState, loadingText, onRetry }: ServerQueryStatusProps) {
  const { messages } = useI18n();
  if (queryState.status === 'loading') return <LoadingStatus>{loadingText}</LoadingStatus>;
  if (queryState.status === 'failed') return <LoadError message={serverErrorText(messages, queryState.errorKind)} onRetry={onRetry} />;
  return null;
}

interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

/** Elenco vuoto: dice cosa succede e cosa fare. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>{title}</p>
      {description && <p className={styles.emptyDescription}>{description}</p>}
      {action}
    </div>
  );
}
