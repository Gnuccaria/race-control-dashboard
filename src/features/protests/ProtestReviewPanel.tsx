import { type Protest, PROTEST_REJECTION_REASON_MAX_LENGTH } from '@shared/protestRules';
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
 * "Salva" chiede conferma; salvata, l'equipaggio vede l'esito nella pagina della protesta sul sito.
 */
export function ProtestReviewPanel({ protest, onSaved }: ProtestReviewPanelProps) {
  const { messages } = useI18n();
  const texts = messages.protests.detail.review;
  const savedIsRejected = protest.status === 'rejected';
  const savedReason = protest.rejectionReason ?? '';
  const [isRejected, setIsRejected] = useState(savedIsRejected);
  const [reason, setReason] = useState(savedReason);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const hasChanges = isRejected !== savedIsRejected || (isRejected && reason.trim() !== savedReason);

  const save = async () => {
    setIsConfirmOpen(false);
    setSaveState({ status: 'saving' });
    const result = await saveProtestReview(protest.id, { isRejected, reason: isRejected ? reason : '' });
    if (!result.isSuccess) {
      setSaveState({ status: 'failed', errorKind: result.errorKind });
      return;
    }
    setReason(result.value.rejectionReason ?? '');
    setSaveState({ status: 'saved' });
    onSaved(result.value);
  };

  return (
    <Panel title={texts.title} description={texts.description}>
      <form
        className={styles.reviewForm}
        noValidate
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          if (hasChanges && saveState.status !== 'saving') setIsConfirmOpen(true);
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
          <Button type="submit" variant="confirm" disabled={!hasChanges || saveState.status === 'saving'}>
            {saveState.status === 'saving' ? texts.saving : texts.save}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={isRejected ? texts.confirmRejectTitle : texts.confirmReopenTitle}
        description={isRejected ? texts.confirmRejectDescription : texts.confirmReopenDescription}
        confirmLabel={texts.confirm}
        cancelLabel={texts.cancel}
        confirmVariant={isRejected ? 'danger' : 'confirm'}
        onConfirm={() => void save()}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </Panel>
  );
}
