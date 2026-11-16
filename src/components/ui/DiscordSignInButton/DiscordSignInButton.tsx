import type { ComponentProps } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import { Button } from '../Button/Button';
import styles from './DiscordSignInButton.module.css';

/**
 * Pulsante di accesso con Discord, nei colori di Discord (blurple e testo bianco) con il simbolo di Discord prima
 * del testo. Lo usano la schermata di accesso dell'app e il sito. Il simbolo è src/assets/discord-mark.svg.
 */
export function DiscordSignInButton({ className, children, ...buttonProps }: Omit<ComponentProps<typeof Button>, 'variant'>) {
  return (
    <Button className={joinClassNames(styles.discordButton, className)} {...buttonProps}>
      <span className={styles.discordMark} aria-hidden="true" />
      {children}
    </Button>
  );
}
