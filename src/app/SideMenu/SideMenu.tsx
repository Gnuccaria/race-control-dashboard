import { useState } from 'react';
import { NavLink } from 'react-router';
import { canUseSection, getSectionHref, getToolHref, TOOL_SECTIONS } from '@/features/tools/toolCatalog';
import { useCurrentUser } from '@/features/user/useCurrentUser';
import { useI18n } from '@/i18n/useI18n';
import styles from './SideMenu.module.css';

/**
 * Menu laterale presente in tutte le pagine dell'app: la home e le sezioni visibili all'utente (secondo i suoi ruoli),
 * ognuna con i suoi strumenti disponibili. La voce della pagina aperta è evidenziata.
 * Nelle finestre strette il menu si apre e si chiude con il pulsante "Menu" e si richiude scegliendo una voce.
 */
export function SideMenu() {
  const { messages } = useI18n();
  const texts = messages.home.sideMenu;
  const currentUser = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const sections = TOOL_SECTIONS.filter((section) => canUseSection(section, currentUser.access));
  const linkClassName = ({ isActive }: { readonly isActive: boolean }) => (isActive ? `${styles.link} ${styles.activeLink}` : styles.link);
  const close = () => {
    setIsOpen(false);
  };

  return (
    <nav className={styles.sideMenu} aria-label={texts.label} data-open={isOpen || undefined}>
      <button type="button" className={styles.toggle} aria-expanded={isOpen} onClick={() => setIsOpen((previous) => !previous)}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d={isOpen ? 'm4 4 10 10M14 4 4 14' : 'M3 5h12M3 9h12M3 13h12'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {isOpen ? texts.close : texts.open}
      </button>
      <ul className={styles.list}>
        <li>
          <NavLink to="/" end className={linkClassName} onClick={close}>
            {texts.home}
          </NavLink>
        </li>
        {sections.map((section) => (
          <li key={section.id}>
            <NavLink to={getSectionHref(section)} end className={({ isActive }) => `${linkClassName({ isActive })} ${styles.sectionLink}`} onClick={close}>
              {messages.home.sections[section.messageKey]}
            </NavLink>
            <ul className={styles.toolList}>
              {section.tools
                .filter((tool) => tool.availability.status === 'available')
                .map((tool) => (
                  <li key={tool.slug}>
                    <NavLink to={getToolHref(section, tool)} className={linkClassName} onClick={close}>
                      {messages.tools[tool.messageKey].name}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
