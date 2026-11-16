import type { ReactNode } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
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
  readonly retryLabel: string;
  readonly onRetry: () => void;
}

/** Errore di caricamento con la possibilità di riprovare. */
export function LoadError({ message, retryLabel, onRetry }: LoadErrorProps) {
  return (
    <div className={styles.loadError}>
      <InlineAlert>{message}</InlineAlert>
      <Button onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
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
