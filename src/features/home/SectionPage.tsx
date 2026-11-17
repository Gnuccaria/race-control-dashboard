import { DocumentTitle } from '@/components/layout/DocumentTitle/DocumentTitle';
import { formatDocumentTitle } from '@/config/appConfig';
import type { ToolSection } from '@/features/tools/toolCatalog';
import { useI18n } from '@/i18n/useI18n';
import { ToolSectionBlock } from './components/ToolSectionList/ToolSectionBlock';
import styles from './HomePage.module.css';

/** Pagina di una sezione (es. /campionati): le card dei suoi strumenti, aperta dal menu laterale. */
export function SectionPage({ section }: { readonly section: ToolSection }) {
  const { messages } = useI18n();
  return (
    <div className={styles.homePage}>
      <DocumentTitle title={formatDocumentTitle(messages.home.sections[section.messageKey])} />
      <ToolSectionBlock section={section} />
    </div>
  );
}
