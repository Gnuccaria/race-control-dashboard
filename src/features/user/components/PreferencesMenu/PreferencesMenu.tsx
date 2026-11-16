import { type ReactNode, useId } from 'react';
import { LanguageSetting } from '@/features/language/components/LanguageSetting/LanguageSetting';
import { NightModeSetting } from '@/features/theme/components/NightModeSetting/NightModeSetting';
import styles from './PreferencesMenu.module.css';

interface PreferencesMenuProps {
  /** Contenuto del pulsante rotondo in alto a destra (avatar dell'utente, o icona generica nel sito). */
  readonly trigger: ReactNode;
  readonly triggerLabel: string;
  /** Sopra le impostazioni (es. nome dell'utente Discord). */
  readonly header?: ReactNode;
  /** Sotto le impostazioni (es. "Esci"). */
  readonly footer?: ReactNode;
  /** Testo della lingua automatica: "lingua del sistema" nell'app, "lingua del browser" nel sito. */
  readonly automaticLanguageLabel?: string;
  /** Altro da tenere accanto alla tendina (es. la finestra di conferma dell'uscita). */
  readonly children?: ReactNode;
}

/**
 * Tendina in alto a destra con modalità notte e lingua, basata sulla Popover API nativa: si chiude
 * con Esc o cliccando fuori, sta sopra a tutto e il browser gestisce aria-expanded.
 * La usano il menu utente dell'app e il sito dei risultati.
 */
export function PreferencesMenu({ trigger, triggerLabel, header, footer, automaticLanguageLabel, children }: PreferencesMenuProps) {
  const panelId = useId();

  return (
    <div className={styles.userMenu}>
      <button type="button" className={styles.userMenuTrigger} popoverTarget={panelId} aria-label={triggerLabel}>
        {trigger}
      </button>

      <div id={panelId} popover="auto" className={styles.userMenuPanel}>
        {header}
        <NightModeSetting />
        <LanguageSetting automaticLabel={automaticLanguageLabel} />
        {footer}
      </div>
      {children}
    </div>
  );
}
