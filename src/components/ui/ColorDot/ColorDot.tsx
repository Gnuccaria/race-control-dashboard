import { joinClassNames } from '@/lib/joinClassNames';
import styles from './ColorDot.module.css';

interface ColorDotProps {
  /** Colore #RRGGBB; null = non indicato (cerchio tratteggiato). */
  readonly color: string | null;
  /** Testo per gli screen reader; senza, il pallino è solo decorativo (il nome accanto basta). */
  readonly label?: string;
  readonly size?: 'small' | 'medium';
}

/** Pallino del colore di un equipaggio. */
export function ColorDot({ color, label, size = 'medium' }: ColorDotProps) {
  return (
    <span
      className={joinClassNames(styles.colorDot, size === 'small' && styles.smallColorDot)}
      style={color ? { backgroundColor: color } : undefined}
      data-empty={color ? undefined : true}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
