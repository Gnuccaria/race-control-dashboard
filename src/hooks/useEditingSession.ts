import { startTransition, useActionState, useState } from 'react';
import type { ServerApiResult, ServerErrorKind } from '@/services/serverApi';

type SaveState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved'; readonly editSession: number }
  | { readonly status: 'failed'; readonly editSession: number; readonly errorKind: ServerErrorKind };

/**
 * Modalità lettura/modifica di una pagina di dettaglio e salvataggio con le Actions di React 19.
 * - editSession cresce a ogni "Modifica": gli esiti di sessioni precedenti non vengono più mostrati.
 * - formKey cresce a ogni uscita dalla modifica (Annulla o salvataggio): rimonta i campi sui valori salvati.
 */
export function useEditingSession<Draft, Saved>(
  saveOnServer: (draft: Draft) => Promise<ServerApiResult<Saved>>,
  onSaved: (saved: Saved) => void,
) {
  const [isEditing, setIsEditing] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const [formKey, setFormKey] = useState(0);

  const [saveState, dispatchSave, isSaving] = useActionState<SaveState, Draft>(async (_previousState, draft) => {
    const saveResult = await saveOnServer(draft);
    if (!saveResult.isSuccess) return { status: 'failed', editSession, errorKind: saveResult.errorKind };

    onSaved(saveResult.value);
    setIsEditing(false);
    setFormKey((previousKey) => previousKey + 1);
    return { status: 'saved', editSession };
  }, { status: 'idle' });

  return {
    isEditing,
    isSaving,
    formKey,
    savedMessageVisible: saveState.status === 'saved' && !isEditing && saveState.editSession === editSession,
    saveErrorKind:
      saveState.status === 'failed' && isEditing && saveState.editSession === editSession ? saveState.errorKind : null,
    startEditing: () => {
      setEditSession((previousSession) => previousSession + 1);
      setIsEditing(true);
    },
    cancelEditing: () => {
      setIsEditing(false);
      setFormKey((previousKey) => previousKey + 1);
    },
    save: (draft: Draft) => {
      startTransition(() => {
        dispatchSave(draft);
      });
    },
  };
}
