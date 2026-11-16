import { useId } from 'react';
import type { ToolSection } from '@/features/tools/toolCatalog';
import { useI18n } from '@/i18n/useI18n';
import { ToolCard } from '../ToolCard/ToolCard';
import styles from './ToolSectionList.module.css';

interface ToolSectionBlockProps {
  readonly section: ToolSection;
}

/** Una sezione della home: titolo e card dei suoi strumenti. */
export function ToolSectionBlock({ section }: ToolSectionBlockProps) {
  const { messages } = useI18n();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.toolSection}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {messages.home.sections[section.messageKey]}
      </h2>
      <ul className={styles.toolCardList}>
        {section.tools.map((tool) => (
          <li key={tool.slug} className={styles.toolCardItem}>
            <ToolCard section={section} tool={tool} />
          </li>
        ))}
      </ul>
    </section>
  );
}
