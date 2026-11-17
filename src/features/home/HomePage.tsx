import { formatDocumentTitle } from '@/config/appConfig';
import { DocumentTitle } from '@/components/layout/DocumentTitle/DocumentTitle';
import { canUseSection, TOOL_SECTIONS } from '@/features/tools/toolCatalog';
import { useCurrentUser } from '@/features/user/useCurrentUser';
import { ToolSectionList } from './components/ToolSectionList/ToolSectionList';
import { WelcomeMessage } from './components/WelcomeMessage/WelcomeMessage';
import styles from './HomePage.module.css';

export function HomePage() {
  const currentUser = useCurrentUser();

  return (
    <div className={styles.homePage}>
      <DocumentTitle title={formatDocumentTitle()} />
      <WelcomeMessage userName={currentUser.displayName} />
      {/* Strumenti della Direzione Gara e dei Commissari Sportivi solo con il ruolo giusto. */}
      <ToolSectionList sections={TOOL_SECTIONS.filter((section) => canUseSection(section, currentUser.access))} />
    </div>
  );
}
