import type { ComponentProps } from 'react';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './Button.module.css';

interface ButtonProps extends ComponentProps<'button'> {
  /**
   * Quattro ruoli, ognuno con il suo colore:
   * - confirm (verde): conferma o salva (Salva, Aggiungi, Salva gara);
   * - primary (nero): azione di servizio che apre o avvia qualcosa (Modifica, Aggiungi penalità, Riprova);
   * - danger (rosso): elimina o esce da un'azione perdendo le modifiche (Elimina, Esci senza salvare);
   * - secondary (contorno neutro): resta nell'azione in corso o annulla (Annulla, Continua a modificare).
   * quiet: link testuale.
   */
  readonly variant?: 'confirm' | 'primary' | 'secondary' | 'danger' | 'quiet';
}

/** Pulsante largo almeno var(--button-min-inline-size), allineato a destra nei contenitori a griglia. */
export function Button({ variant = 'primary', className, type = 'button', ...buttonProps }: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames(styles.button, styles[variant], className)}
      {...buttonProps}
    />
  );
}
