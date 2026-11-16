import type { SortDirection } from '@/lib/sorting';
import styles from './DataTableIcons.module.css';

interface SortDirectionIconProps {
  readonly direction: SortDirection;
}

/**
 * Freccia di ordinamento: punta in alto per il crescente, in basso per il decrescente.
 * Il cambio di direzione è una rotazione animata; alla prima comparsa entra con una breve dissolvenza.
 */
export function SortDirectionIcon({ direction }: SortDirectionIconProps) {
  return (
    <svg
      className={styles.sortDirectionIcon}
      data-direction={direction}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 11.5v-9M3 6.5l4-4 4 4" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m7 4 5 5-5 5" />
    </svg>
  );
}

interface MissingDataIconProps {
  /** Testo dell'avviso, letto dagli screen reader e mostrato al passaggio del mouse. */
  readonly label: string;
}

/** Triangolo di avviso accanto agli equipaggi con dati mancanti. */
export function MissingDataIcon({ label }: MissingDataIconProps) {
  return (
    <span className={styles.missingDataIcon} title={label}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7.13 2.5 1.6 12.1A1 1 0 0 0 2.47 13.6h11.06a1 1 0 0 0 .87-1.5L8.87 2.5a1 1 0 0 0-1.74 0Z" />
        <path d="M8 6.2v3.1M8 11.4h.01" />
      </svg>
      <span className={styles.visuallyHidden}>{label}</span>
    </span>
  );
}
