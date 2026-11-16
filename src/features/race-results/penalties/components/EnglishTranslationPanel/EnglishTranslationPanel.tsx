import { ENGLISH_REASON_MAX_LENGTH, type EnglishPenaltyText, normalizeReason, type PenaltyDraft, type SavedPenalty } from '@shared/penaltyRules';
import { useState, useTransition } from 'react';
import { EditingActions } from '@/components/editing/EditingActions';
import { LeaveEditingGuard } from '@/components/editing/LeaveEditingGuard';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Panel } from '@/components/ui/Panel/Panel';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { useEditingSession } from '@/hooks/useEditingSession';
import { useI18n } from '@/i18n/useI18n';
import { updatePenalty } from '../../services/penaltyApi';
import styles from './EnglishTranslationPanel.module.css';

/** La penalità salvata così com'è, con la sola traduzione da cambiare (oggetto = a mano, null = rifarla in automatico). */
const withEnglishText = (penalty: SavedPenalty, englishText: EnglishPenaltyText | null): PenaltyDraft => ({
  crews: penalty.crews.map(({ crewId, decision }) => ({ crewId, decision })),
  violation: penalty.violation,
  document: penalty.document,
  reason: penalty.reason,
  englishText,
});

type TranslationStatus = 'automatic' | 'manual' | 'outdated' | 'missing';

const translationStatus = (english: SavedPenalty['english']): TranslationStatus =>
  english === null ? 'missing' : english.isOutdated ? 'outdated' : english.source;

interface EnglishTranslationFormProps {
  readonly savedPenalty: SavedPenalty;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly isRetranslating: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onSave: (englishText: EnglishPenaltyText) => void;
  readonly onRetranslate: () => void;
}

/** Motivazione in inglese: rimontando (nuova key) torna alla traduzione salvata. */
function EnglishTranslationForm({ savedPenalty, isEditing, isSaving, isRetranslating, onEdit, onCancel, onSave, onRetranslate }: EnglishTranslationFormProps) {
  const { messages } = useI18n();
  const texts = messages.penalties.english;
  const [reason, setReason] = useState(savedPenalty.english?.reason ?? '');
  const isReasonMissing = normalizeReason(reason) === '';
  const isReasonTooLong = normalizeReason(reason).length > ENGLISH_REASON_MAX_LENGTH;
  const canSave = !isReasonMissing && !isReasonTooLong;

  return (
    <form
      className={styles.englishTranslationForm}
      noValidate
      lang="en"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        if (canSave) onSave({ reason });
      }}
    >
      <FormField
        label={texts.reason}
        errorMessage={isEditing && isReasonTooLong ? texts.reasonTooLong(ENGLISH_REASON_MAX_LENGTH) : undefined}
      >
        {({ isInvalid, ...textareaAttributes }) => (
          <Textarea
            {...textareaAttributes}
            rows={5}
            maxLength={ENGLISH_REASON_MAX_LENGTH}
            readOnly={!isEditing}
            isInvalid={isInvalid}
            value={reason}
            onValueChange={setReason}
          />
        )}
      </FormField>
      <EditingActions
        isEditing={isEditing}
        isSaving={isSaving}
        canSave={canSave}
        onEdit={onEdit}
        onCancel={onCancel}
        readActions={
          <Button key="retranslate" variant="primary" disabled={isRetranslating} onClick={onRetranslate}>
            {isRetranslating ? texts.retranslating : texts.retranslate}
          </Button>
        }
      />
    </form>
  );
}

interface EnglishTranslationPanelProps {
  readonly savedPenalty: SavedPenalty;
  readonly onSaved: (penalty: SavedPenalty) => void;
}

/**
 * Motivazione in inglese, usata nel referto in inglese del sito (la violazione è una frase fissa con numero e
 * documento, non si traduce). Il server la traduce da sé quando cambia la motivazione; qui si legge, si corregge
 * a mano ("Modifica") o si rifà ("Rifai traduzione").
 */
export function EnglishTranslationPanel({ savedPenalty, onSaved }: EnglishTranslationPanelProps) {
  const { messages } = useI18n();
  const texts = messages.penalties.english;
  // "Modifiche salvate" vale solo finché la penalità non cambia altrove (per esempio dal pannello sopra).
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const editing = useEditingSession(
    (englishText: EnglishPenaltyText) => updatePenalty(savedPenalty.raceId, savedPenalty.id, withEnglishText(savedPenalty, englishText)),
    (penalty: SavedPenalty) => {
      setSavedAt(penalty.updatedAt);
      onSaved(penalty);
    },
  );
  const [isRetranslating, startRetranslating] = useTransition();
  const [retranslateError, setRetranslateError] = useState<string | null>(null);
  const status = translationStatus(savedPenalty.english);

  const retranslate = () => {
    setRetranslateError(null);
    startRetranslating(async () => {
      const result = await updatePenalty(savedPenalty.raceId, savedPenalty.id, withEnglishText(savedPenalty, null));
      if (!result.isSuccess) {
        setRetranslateError(messages.serverErrors[result.errorKind]);
        return;
      }
      setSavedAt(null);
      onSaved(result.value);
      editing.cancelEditing();
      if (result.value.english === null) setRetranslateError(texts.retranslateFailed);
    });
  };

  if (savedPenalty.reason === '') {
    return (
      <Panel title={texts.panelTitle} description={texts.description}>
        <p className={styles.translationStatus}>{texts.noReason}</p>
      </Panel>
    );
  }

  return (
    <Panel title={texts.panelTitle} description={editing.isEditing ? texts.editingDescription : texts.description}>
      {!editing.isEditing && (
        <p className={styles.translationStatus} data-status={status} role="status">
          {texts.status[status]}
        </p>
      )}
      {editing.savedMessageVisible && savedAt === savedPenalty.updatedAt && <InlineAlert tone="success">{messages.editing.saved}</InlineAlert>}
      {editing.saveErrorKind && <InlineAlert>{messages.serverErrors[editing.saveErrorKind]}</InlineAlert>}
      {retranslateError && !editing.isEditing && <InlineAlert>{retranslateError}</InlineAlert>}
      <EnglishTranslationForm
        key={`${editing.formKey}-${savedPenalty.updatedAt}`}
        savedPenalty={savedPenalty}
        isEditing={editing.isEditing}
        isSaving={editing.isSaving}
        isRetranslating={isRetranslating}
        onEdit={editing.startEditing}
        onCancel={editing.cancelEditing}
        onSave={editing.save}
        onRetranslate={retranslate}
      />
      <LeaveEditingGuard isActive={editing.isEditing} />
    </Panel>
  );
}
