import type { ComponentProps } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label'> {
  /** Obbligatoria: il pulsante contiene solo un'icona. */
  readonly accessibleLabel: string;
}

export function IconButton({ accessibleLabel, className, type = 'button', ...buttonProps }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={accessibleLabel}
      className={joinClassNames(styles.iconButton, className)}
      {...buttonProps}
    />
  );
}
