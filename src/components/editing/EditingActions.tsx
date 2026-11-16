import { type ReactNode, useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { Button } from '@/components/ui/Button/Button';
import { useI18n } from '@/i18n/useI18n';
import styles from './EditingActions.module.css';

interface EditingActionsProps {
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  /** false finché i dati non sono validi: "Salva" resta disattivato. */
  readonly canSave: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  /** Altri pulsanti da mostrare in lettura, prima di "Modifica". */
  readonly readActions?: ReactNode;
}

/**
 * Pulsanti in fondo a una pagina di dettaglio: in lettura solo "Modifica"; in modifica "Annulla" e "Salva".
 * "Salva" invia il form che li contiene; "Annulla" chiede conferma prima di perdere le modifiche.
 */
export function EditingActions({ isEditing, isSaving, canSave, onEdit, onCancel, readActions }: EditingActionsProps) {
  const { messages } = useI18n();
  const editingTexts = messages.editing;
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  return (
    <div className={styles.editingActions}>
      {isEditing ? (
        <>
          {/* Key distinte: "Annulla" non riusa l'elemento di "Modifica" (eviterebbe una transizione di colore a metà). */}
          <Button
            key="cancel"
            variant="secondary"
            disabled={isSaving}
            onClick={() => {
              setIsDiscardConfirmOpen(true);
            }}
          >
            {editingTexts.cancel}
          </Button>
          <Button key="save" variant="confirm" type="submit" disabled={!canSave || isSaving}>
            {isSaving ? editingTexts.saving : editingTexts.save}
          </Button>
        </>
      ) : (
        <>
          {readActions}
          <Button key="edit" onClick={onEdit}>
            {editingTexts.edit}
          </Button>
        </>
      )}
      <ConfirmDialog
        isOpen={isDiscardConfirmOpen}
        title={editingTexts.discardTitle}
        description={editingTexts.discardDescription}
        confirmLabel={editingTexts.discardConfirm}
        cancelLabel={editingTexts.leaveCancel}
        onConfirm={() => {
          setIsDiscardConfirmOpen(false);
          onCancel();
        }}
        onCancel={() => {
          setIsDiscardConfirmOpen(false);
        }}
      />
    </div>
  );
}
