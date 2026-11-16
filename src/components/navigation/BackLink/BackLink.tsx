import { Link, type RelativeRoutingType } from 'react-router';
import styles from './BackLink.module.css';

export interface BackLinkTarget {
  readonly to: string;
  readonly label: string;
  /** "path": "to" è relativo all'URL corrente (es. ".." = pagina superiore). */
  readonly relative?: RelativeRoutingType;
}

interface BackLinkProps {
  readonly to: string;
  readonly relative?: RelativeRoutingType | undefined;
  readonly children: string;
}

/** Link discreto per tornare alla pagina superiore. */
export function BackLink({ to, relative, children }: BackLinkProps) {
  return (
    <Link to={to} relative={relative} className={styles.backLink}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
      {children}
    </Link>
  );
}
