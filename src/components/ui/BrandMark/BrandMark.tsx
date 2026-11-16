import { joinClassNames } from '@/lib/joinClassNames';
import styles from './BrandMark.module.css';

interface BrandMarkProps {
  readonly size?: 'small' | 'large';
}

/** Marchio: una piccola lavagna dei box con la linea gialla del traguardo. */
export function BrandMark({ size = 'small' }: BrandMarkProps) {
  return (
    <span aria-hidden="true" className={joinClassNames(styles.brandMark, size === 'large' && styles.largeBrandMark)}>
      <span className={styles.brandMarkStripe} />
    </span>
  );
}
