import type { SavedCrew } from '@shared/crewRules';
import { canReviewProtest, type Protest, PROTEST_REJECTION_REASON_MAX_LENGTH, type ProtestPenalty, protestCrewIds, type ProtestReview } from '@shared/protestRules';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Panel } from '@/components/ui/Panel/Panel';
import { Switch } from '@/components/ui/Switch/Switch';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { fetchCrews } from '@/features/crews/services/crewApi';
import { PenaltyFields } from '@/features/race-results/penalties/components/PenaltyFields/PenaltyFields';
import { usePenaltyDraft } from '@/features/race-results/penalties/hooks/usePenaltyDraft';
import { useServerQuery } from '@/hooks/useServerQuery';
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
 * Vetture della protesta per il modulo della penalità: dall'elenco degli equipaggi (con il colore) quando è letto,
 * altrimenti con i dati copiati nella protesta.
 */
function useProtestCrews(protest: Protest): SavedCrew[] {
  const { queryState } = useServerQuery('crews', fetchCrews);
  const savedCrews = queryState.status === 'loaded' ? queryState.value : [];
  return [protest.crew, ...protest.otherCrews].map(
    (crew) =>
      savedCrews.find((savedCrew) => savedCrew.id === crew.id) ?? {
        id: crew.id,
        number: crew.number,
        name: crew.name,
        carId: null,
        championship: null,
        color: null,
        createdAt: '',
      },
  );
}

/** Penalità di una protesta accolta, in sola lettura. */
function AcceptedPenalty({ protest, penalty }: { readonly protest: Protest; readonly penalty: ProtestPenalty }) {
  const crews = useProtestCrews(protest);
  const draft = usePenaltyDraft({ crews: penalty.crews, violation: penalty.violation, document: penalty.document, reason: penalty.reason });
  return <PenaltyFields draft={draft} crews={crews} isReadOnly />;
}

/**
 * Esito della protesta, definitivo. L'interruttore "Respingi protesta" non è obbligatorio:
 * - acceso: la protesta è respinta e la motivazione è obbligatoria;
 * - spento: la protesta è accolta e sotto si decide la penalità, come una nuova penalità della gara, con le vetture
 *   coinvolte già compilate (l'equipaggio della protesta e gli altri equipaggi coinvolti); violazione, documento e
 *   motivazione obbligatori. Salvata, la penalità va tra quelle della gara (referto PDF, traduzione inglese automatica).
 * Una protesta mandata prima che si scegliesse la gara si può solo respingere.
 */
export function ProtestReviewPanel({ protest, onSaved }: ProtestReviewPanelProps) {
  const { messages } = useI18n();
  const texts = messages.protests.detail.review;
  const canAccept = protest.race !== null;
  const [isRejectedChoice, setIsRejected] = useState(false);
  const isRejected = isRejectedChoice || !canAccept;
  const [reason, setReason] = useState('');
  const penaltyDraft = usePenaltyDraft({ crews: protestCrewIds(protest).map((crewId) => ({ crewId, decision: null })), violation: '', document: '', reason: '' });
  const crews = useProtestCrews(protest);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });

  const isPenaltyComplete = penaltyDraft.check.isComplete && penaltyDraft.values.reason.trim() !== '';
  const canSave = saveState.status !== 'saving' && (isRejected ? reason.trim() !== '' : isPenaltyComplete);

  const save = async () => {
    setIsConfirmOpen(false);
    setSaveState({ status: 'saving' });
    const { crews: penaltyCrews, violation, document, reason: penaltyReason } = penaltyDraft.values;
    const review: ProtestReview = isRejected
      ? { decision: 'rejected', reason }
      : { decision: 'accepted', penalty: { crews: penaltyCrews, violation, document: document === '' ? 'code-of-conduct' : document, reason: penaltyReason } };
    const result = await saveProtestReview(protest.id, review);
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
          <p>{protest.status === 'accepted' ? texts.finalAccepted : texts.finalDecision}</p>
          {protest.status === 'rejected' && (
            <FormField label={texts.reason}>
              {(textareaAttributes) => <Textarea {...textareaAttributes} rows={3} readOnly value={protest.rejectionReason || texts.noReason} onValueChange={() => undefined} />}
            </FormField>
          )}
          {protest.status === 'accepted' && protest.penalty && <AcceptedPenalty protest={protest} penalty={protest.penalty} />}
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
          if (canSave) setIsConfirmOpen(true);
        }}
      >
        {canAccept ? (
          <Switch
            label={texts.rejectToggle}
            description={texts.rejectToggleDescription}
            isChecked={isRejected}
            onCheckedChange={(isChecked) => {
              setIsRejected(isChecked);
              setSaveState({ status: 'idle' });
            }}
          />
        ) : (
          <InlineAlert>{texts.noRace}</InlineAlert>
        )}
        {isRejected ? (
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
        ) : (
          <section className={styles.reviewPenalty} aria-labelledby="protest-penalty-title">
            <h3 id="protest-penalty-title" className={styles.reviewPenaltyTitle}>
              {texts.penaltyTitle}
            </h3>
            <p className={styles.reviewPenaltyDescription}>{texts.penaltyDescription}</p>
            <PenaltyFields draft={penaltyDraft} crews={crews} isReadOnly={false} areCrewsFixed crewsHint={texts.penaltyCrewsHint} reasonHint={texts.penaltyReasonHint} />
          </section>
        )}
        {saveState.status === 'failed' && <InlineAlert>{messages.serverErrors[saveState.errorKind]}</InlineAlert>}
        <div className={styles.reviewActions}>
          <Button type="submit" variant="confirm" disabled={!canSave}>
            {saveState.status === 'saving' ? texts.saving : texts.save}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={isRejected ? texts.confirmRejectTitle : texts.confirmAcceptTitle}
        description={isRejected ? texts.confirmRejectDescription : texts.confirmAcceptDescription}
        confirmLabel={texts.confirm}
        cancelLabel={texts.cancel}
        confirmVariant={isRejected ? 'danger' : 'confirm'}
        onConfirm={() => void save()}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </Panel>
  );
}
