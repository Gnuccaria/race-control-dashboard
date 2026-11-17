import { startTransition, useActionState, useState } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { Button } from '@/components/ui/Button/Button';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import styles from './Championships.module.css';
import { ChampionshipFields } from './components/ChampionshipFields/ChampionshipFields';
import { useChampionshipDraft } from './hooks/useChampionshipDraft';
import { createChampionship } from './services/championshipApi';
import { serverErrorText } from '@/services/serverErrorText';

type CreateState =
  | { readonly status: 'idle' }
  | { readonly status: 'created'; readonly name: string }
  | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };

interface CreateChampionshipFormProps {
  readonly onCreated: (name: string) => void;
}

/** Campi del nuovo campionato e "Crea campionato"; rimontato (nuova key) dopo un salvataggio, torna vuoto. */
function CreateChampionshipForm({ onCreated }: CreateChampionshipFormProps) {
  const { messages } = useI18n();
  const texts = messages.championships;
  const draft = useChampionshipDraft();
  const [state, dispatch, isCreating] = useActionState<CreateState, null>(async () => {
    const validation = draft.validate();
    if (!validation.isValid) return { status: 'failed', errorKind: 'invalid-championship' };
    const result = await createChampionship(validation.championship);
    if (!result.isSuccess) return { status: 'failed', errorKind: result.errorKind };
    onCreated(result.value.name);
    return { status: 'created', name: result.value.name };
  }, { status: 'idle' });

  return (
    <form
      className={styles.form}
      noValidate
      aria-busy={isCreating}
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        startTransition(() => {
          dispatch(null);
        });
      }}
    >
      {state.status === 'failed' && <InlineAlert>{serverErrorText(messages, state.errorKind)}</InlineAlert>}
      <ChampionshipFields draft={draft} />
      <div className={styles.actions}>
        <Button type="submit" variant="confirm" disabled={!draft.isComplete || isCreating}>
          {isCreating ? texts.creating : texts.create}
        </Button>
      </div>
    </form>
  );
}

/** Schermata "Crea campionato" della sezione Gestione campionati. */
export function CreateChampionshipPage() {
  const { messages } = useI18n();
  const texts = messages.championships;
  const [created, setCreated] = useState<{ readonly name: string; readonly count: number } | null>(null);

  return (
    <div className={styles.page}>
      <ToolPageHeader name={messages.tools.createChampionship.name} description={messages.tools.createChampionship.description} />
      <Panel title={texts.formTitle} description={texts.formDescription}>
        {created && <InlineAlert tone="success">{texts.created(created.name)}</InlineAlert>}
        <CreateChampionshipForm key={created?.count ?? 0} onCreated={(name) => setCreated((previous) => ({ name, count: (previous?.count ?? 0) + 1 }))} />
      </Panel>
    </div>
  );
}
