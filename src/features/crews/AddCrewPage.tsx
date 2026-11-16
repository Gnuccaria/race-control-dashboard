import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { useI18n } from '@/i18n/useI18n';
import styles from './AddCrewPage.module.css';
import { CreateCrewForm } from './components/CreateCrewForm/CreateCrewForm';

/** Schermata "Aggiungi equipaggio" della sezione Gestisci campionato. */
export function AddCrewPage() {
  const { messages } = useI18n();

  return (
    <div className={styles.addCrewPage}>
      <ToolPageHeader name={messages.tools.addCrew.name} description={messages.tools.addCrew.description} />
      <CreateCrewForm />
    </div>
  );
}
