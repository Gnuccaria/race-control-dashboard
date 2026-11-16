import type { ToolSection } from '@/features/tools/toolCatalog';
import { ToolSectionBlock } from './ToolSectionBlock';
import styles from './ToolSectionList.module.css';

interface ToolSectionListProps {
  readonly sections: readonly ToolSection[];
}

export function ToolSectionList({ sections }: ToolSectionListProps) {
  return (
    <div className={styles.toolSectionList}>
      {sections.map((section) => (
        <ToolSectionBlock key={section.id} section={section} />
      ))}
    </div>
  );
}
