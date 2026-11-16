import type { ComponentType } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge/StatusBadge';
import styles from './ToolCard.module.css';

interface ToolCardContentProps {
  readonly Icon: ComponentType;
  readonly name: string;
  readonly description: string;
  /** Etichetta di stato in alto a destra, es. "In costruzione". */
  readonly statusLabel?: string;
}

export function ToolCardContent({ Icon, name, description, statusLabel }: ToolCardContentProps) {
  return (
    <>
      <span className={styles.toolCardHeader}>
        <span className={styles.toolIcon}>
          <Icon />
        </span>
        {statusLabel && <StatusBadge label={statusLabel} />}
      </span>
      <span className={styles.toolText}>
        <span className={styles.toolName}>{name}</span>
        <span className={styles.toolDescription}>{description}</span>
      </span>
    </>
  );
}
