import type { SavedCrew } from '@shared/crewRules';
import type { PenaltyDraft } from '@shared/penaltyRules';
import { startTransition, useActionState } from 'react';
import { useNavigate } from 'react-router';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import { BACK_TO_RACE_PENALTIES } from '../../hooks/usePenaltyRace';
import { usePenaltyDraft } from '../../hooks/usePenaltyDraft';
import { createPenalty } from '../../services/penaltyApi';
import { PenaltyFields } from '../PenaltyFields/PenaltyFields';
import styles from './CreatePenaltyForm.module.css';

type CreatePenaltyState = { readonly status: 'idle' } | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };

interface CreatePenaltyFormProps {
  readonly raceId: number;
  readonly crews: readonly SavedCrew[];
  readonly reprimandCountsBefore: ReadonlyMap<number, number> | undefined;
}

/** Nuova penalità: i quattro campi e "Aggiungi"; salvata, si torna alla scheda Penalità della gara. */
export function CreatePenaltyForm({ raceId, crews, reprimandCountsBefore }: CreatePenaltyFormProps) {
  const { messages } = useI18n();
  const texts = messages.penalties.form;
  const draft = usePenaltyDraft();
  const navigate = useNavigate();
  const [createState, dispatchCreate, isCreating] = useActionState<CreatePenaltyState, PenaltyDraft>(async (_previousState, penalty) => {
    const creationResult = await createPenalty(raceId, penalty);
    if (!creationResult.isSuccess) return { status: 'failed', errorKind: creationResult.errorKind };
    await navigate(BACK_TO_RACE_PENALTIES, { relative: 'path', replace: true });
    return { status: 'idle' };
  }, { status: 'idle' });

  return (
    <form
      className={styles.createPenaltyForm}
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const validation = draft.validate();
        if (validation.isValid) {
          startTransition(() => {
            dispatchCreate(validation.penalty);
          });
        }
      }}
    >
      <PenaltyFields draft={draft} crews={crews} isReadOnly={false} reprimandCountsBefore={reprimandCountsBefore} />
      {createState.status === 'failed' && <InlineAlert>{messages.serverErrors[createState.errorKind]}</InlineAlert>}
      <Button type="submit" variant="confirm" disabled={!draft.check.isComplete || isCreating}>
        {isCreating ? texts.adding : texts.add}
      </Button>
    </form>
  );
}
