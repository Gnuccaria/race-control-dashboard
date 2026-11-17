import { canReviewProtest, type Protest, PROTEST_REJECTION_REASON_MAX_LENGTH } from '@shared/protestRules';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Panel } from '@/components/ui/Panel/Panel';
import { Switch } from '@/components/ui/Switch/Switch';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import styles from './Protests.module.css';
import { saveProtestReview } from './services/protestApi';

type SaveState = { readonly status: 'idle' } | { readonly status: 'saving' } | { readonly status: 'saved' } | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };

interface ProtestReviewPanelProps {
  readonly protest: Protest;
  readonly onSaved: (protest: Protest) => void;
}

/**
 * Esito della protesta: l'interruttore "Respingi protesta" e, se acceso, la motivazione facoltativa.
 * "Salva" chiede conferma; il rifiuto è definitivo: da quel momento il pannello è in sola lettura e l'equipaggio
 * vede l'esito (e una notifica) sul sito.
 */
export function ProtestReviewPanel({ protest, onSaved }: ProtestReviewPanelProps) {
  const { messages } = useI18n();
  const texts = messages.protests.detail.review;
  const [isRejected, setIsRejected] = useState(false);
  const [reason, setReason] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });

  const save = async () => {
    setIsConfirmOpen(false);
    setSaveState({ status: 'saving' });
    const result = await saveProtestReview(protest.id, { isRejected: true, reason });
    if (!result.isSuccess) {
      setSaveState({ status: 'failed', errorKind: result.errorKind });
      return;
    }
    setSaveState({ status: 'saved' });
    onSaved(result.value);
  };

  if (!canReviewProtest(protest.status)) {
    return (
      <Panel title={texts.title}>
        <div className={styles.reviewForm}>
          {saveState.status === 'saved' && <InlineAlert tone="success">{texts.saved}</InlineAlert>}
          <p>{texts.finalDecision}</p>
          <FormField label={texts.reason}>
            {(textareaAttributes) => <Textarea {...textareaAttributes} rows={3} readOnly value={protest.rejectionReason || texts.noReason} onValueChange={() => undefined} />}
          </FormField>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={texts.title} description={texts.description}>
      <form
        className={styles.reviewForm}
        noValidate
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          if (isRejected && saveState.status !== 'saving') setIsConfirmOpen(true);
        }}
      >
        <Switch
          label={texts.rejectToggle}
          description={texts.rejectToggleDescription}
          isChecked={isRejected}
          onCheckedChange={(isChecked) => {
            setIsRejected(isChecked);
            setSaveState({ status: 'idle' });
          }}
        />
        {isRejected && (
          <FormField label={texts.reason} hint={texts.reasonHint}>
            {({ isInvalid, ...textareaAttributes }) => (
              <Textarea
                {...textareaAttributes}
                rows={3}
                maxLength={PROTEST_REJECTION_REASON_MAX_LENGTH}
                isInvalid={isInvalid}
                value={reason}
                onValueChange={(nextReason) => {
                  setReason(nextReason);
                  setSaveState({ status: 'idle' });
                }}
              />
            )}
          </FormField>
        )}
        {saveState.status === 'saved' && <InlineAlert tone="success">{texts.saved}</InlineAlert>}
        {saveState.status === 'failed' && <InlineAlert>{messages.serverErrors[saveState.errorKind]}</InlineAlert>}
        <div className={styles.reviewActions}>
          <Button type="submit" variant="confirm" disabled={!isRejected || saveState.status === 'saving'}>
            {saveState.status === 'saving' ? texts.saving : texts.save}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={texts.confirmRejectTitle}
        description={texts.confirmRejectDescription}
        confirmLabel={texts.confirm}
        cancelLabel={texts.cancel}
        confirmVariant="danger"
        onConfirm={() => void save()}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </Panel>
  );
}
