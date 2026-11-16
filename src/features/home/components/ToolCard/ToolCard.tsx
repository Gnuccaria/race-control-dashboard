import { Link } from 'react-router';
import { getToolHref, type ToolDefinition, type ToolSection } from '@/features/tools/toolCatalog';
import { useI18n } from '@/i18n/useI18n';
import styles from './ToolCard.module.css';
import { ToolCardContent } from './ToolCardContent';

interface ToolCardProps {
  readonly section: ToolSection;
  readonly tool: ToolDefinition;
}

/**
 * Card di uno strumento: cliccabile per intero se disponibile, altrimenti
 * disattivata con l'etichetta "In costruzione" (non è un link, quindi non è raggiungibile col Tab).
 */
export function ToolCard({ section, tool }: ToolCardProps) {
  const { messages } = useI18n();
  const toolTexts = messages.tools[tool.messageKey];

  if (tool.availability.status === 'under-construction') {
    return (
      <div className={styles.toolCard} aria-disabled="true" data-under-construction>
        <ToolCardContent
          Icon={tool.Icon}
          name={toolTexts.name}
          description={toolTexts.description}
          statusLabel={messages.home.underConstruction}
        />
      </div>
    );
  }

  return (
    <Link to={getToolHref(section, tool)} className={styles.toolCard}>
      <ToolCardContent Icon={tool.Icon} name={toolTexts.name} description={toolTexts.description} />
    </Link>
  );
}
