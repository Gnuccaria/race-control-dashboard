import { BackLink, type BackLinkTarget } from '@/components/navigation/BackLink/BackLink';
import { formatDocumentTitle } from '@/config/appConfig';
import { useI18n } from '@/i18n/useI18n';
import styles from './ToolPageHeader.module.css';

interface ToolPageHeaderProps {
  readonly name: string;
  readonly description: string;
  /** Di default torna alla home; le sotto-pagine indicano la loro pagina superiore; null = nessun link (pagina iniziale). */
  readonly backLink?: BackLinkTarget | null;
  /** Titolo della scheda del browser; di default "<nome> – Race Control Dashboard". */
  readonly documentTitle?: string;
}

/** Intestazione comune a tutti gli strumenti: ritorno alla pagina superiore, nome e descrizione. */
export function ToolPageHeader({ name, description, backLink, documentTitle }: ToolPageHeaderProps) {
  const { messages } = useI18n();
  const backLinkTarget = backLink === undefined ? { to: '/', label: messages.app.backToAllTools } : backLink;

  return (
    <header className={styles.toolPageHeader}>
      <title>{documentTitle ?? formatDocumentTitle(name)}</title>
      {backLinkTarget && (
        <BackLink to={backLinkTarget.to} relative={backLinkTarget.relative}>
          {backLinkTarget.label}
        </BackLink>
      )}
      <h1 className={styles.toolTitle}>{name}</h1>
      <p className={styles.toolDescription}>{description}</p>
    </header>
  );
}
