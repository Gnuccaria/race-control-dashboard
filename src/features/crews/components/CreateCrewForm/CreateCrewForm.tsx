import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import { useCreateCrew } from '../../hooks/useCreateCrew';
import { AddCrewFields } from '../AddCrewFields/AddCrewFields';
import styles from './CreateCrewForm.module.css';
import { serverErrorText } from '@/services/serverErrorText';

/** Form del nuovo equipaggio: esito dell'ultimo invio sopra, campi sotto. */
export function CreateCrewForm() {
  const { messages } = useI18n();
  const { submissionState, handleCrewSubmit, isSubmitting, formResetKey } = useCreateCrew();
  const crewTexts = messages.crews;

  return (
    <Panel title={crewTexts.formTitle} description={crewTexts.formDescription}>
      <form onSubmit={handleCrewSubmit} className={styles.createCrewForm} aria-busy={isSubmitting} noValidate>
        {submissionState.status === 'created' && (
          <InlineAlert tone="success">{crewTexts.crewCreated(submissionState.crewName)}</InlineAlert>
        )}
        {submissionState.status === 'failed' && <InlineAlert>{serverErrorText(messages, submissionState.errorKind)}</InlineAlert>}
        <AddCrewFields key={formResetKey} isSubmitting={isSubmitting} />
      </form>
    </Panel>
  );
}
