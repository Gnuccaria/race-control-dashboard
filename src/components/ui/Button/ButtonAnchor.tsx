import type { ComponentProps } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './Button.module.css';

interface ButtonAnchorProps extends ComponentProps<'a'> {
  /** Stessi ruoli e colori di Button. */
  readonly variant?: 'confirm' | 'primary' | 'secondary' | 'danger';
}

/** Link a un file (es. un PDF da scaricare) con l'aspetto di un pulsante. */
export function ButtonAnchor({ variant = 'primary', className, ...anchorProps }: ButtonAnchorProps) {
  return <a className={joinClassNames(styles.button, styles[variant], styles.anchor, className)} {...anchorProps} />;
}
