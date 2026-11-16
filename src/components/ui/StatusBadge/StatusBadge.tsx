import type { ReactNode } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './StatusBadge.module.css';

/**
 * Colore della pillola: positive (verde, es. "In orario"), warning (ambra, es. "In anticipo", "In costruzione"),
 * critical (rosso, es. "In ritardo").
 */
export type StatusTone = 'positive' | 'warning' | 'critical';

interface StatusBadgeProps {
  /** Testo della pillola, come label o come contenuto. */
  readonly label?: string;
  readonly children?: ReactNode;
  readonly tone?: StatusTone;
  readonly className?: string | undefined;
}

/** Etichetta di stato a pillola, es. "In orario" nel calcolatore di giri o "In costruzione" sulle card. */
export function StatusBadge({ label, children, tone = 'warning', className }: StatusBadgeProps) {
  return <span className={joinClassNames(styles.statusBadge, styles[tone], className)}>{children ?? label}</span>;
}
