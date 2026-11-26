import { startTransition, useActionState, useState } from 'react';
import type { ServerApiResult, ServerErrorKind } from '@/services/serverApi';

export type SourceRefreshState<Preview> =
  | { readonly status: 'idle' }
  | { readonly status: 'preview'; readonly preview: Preview; readonly sentChoices: unknown }
  | { readonly status: 'saved'; readonly preview: Preview }
  | { readonly status: 'failed'; readonly errorKind: ServerErrorKind; readonly preview: Preview | null };

/** refetch: true solo per "Aggiorna dati" (riscarica i siti); ricalcolo e invio riusano i dati dell'anteprima. */
type SourceRefreshAction<Choices> = { readonly apply: boolean; readonly refetch: boolean; readonly choices: Choices } | { readonly close: true };

interface SourceRefreshOptions<Choices, Preview> {
  /** Chiede al server anteprima (apply: false) o salvataggio (apply: true) con gli abbinamenti scelti a mano. */
  readonly refresh: (choices: Choices, mode: { readonly apply: boolean; readonly refetch: boolean }) => Promise<ServerApiResult<{ readonly preview: Preview }>>;
  readonly initialChoices: Choices;
  /** Le scelte attuali sono quelle con cui è stata calcolata l'anteprima? (solo allora si può inviare) */
  readonly sameChoices: (first: Choices, second: Choices) => boolean;
  /** Dopo il salvataggio: la pagina rilegge i dati. */
  readonly onSaved: () => void;
}

/**
 * Aggiornamento manuale di un catalogo dai siti (vetture, tracciati): "Aggiorna dati" scarica e mostra l'anteprima,
 * gli abbinamenti scelti a mano la fanno ricalcolare, "Invia al server" salva. Il pannello (SourceRefreshPanel) mostra
 * lo stato; qui c'è il flusso, uguale per tutti i cataloghi.
 */
export function useSourceRefresh<Choices, Preview>({ refresh, initialChoices, sameChoices, onSaved }: SourceRefreshOptions<Choices, Preview>) {
  const [choices, setChoices] = useState<Choices>(initialChoices);
  const [state, dispatch, isWorking] = useActionState<SourceRefreshState<Preview>, SourceRefreshAction<Choices>>(async (previousState, action) => {
    if ('close' in action) return { status: 'idle' };
    const currentPreview = 'preview' in previousState ? previousState.preview : null;
    const result = await refresh(action.choices, { apply: action.apply, refetch: action.refetch });
    if (!result.isSuccess) return { status: 'failed', errorKind: result.errorKind, preview: currentPreview };
    if (action.apply) {
      onSaved();
      return { status: 'saved', preview: result.value.preview };
    }
    return { status: 'preview', preview: result.value.preview, sentChoices: action.choices };
  }, { status: 'idle' });

  const run = (action: SourceRefreshAction<Choices>) => {
    startTransition(() => {
      dispatch(action);
    });
  };

  return {
    state,
    isWorking,
    choices,
    setChoices,
    /** Anteprima da mostrare (anche dopo un errore, per non perderla). */
    preview: state.status === 'preview' || state.status === 'failed' ? state.preview : null,
    isPreviewCurrent: state.status === 'preview' && sameChoices(state.sentChoices as Choices, choices),
    start: () => run({ apply: false, refetch: true, choices }),
    recalculate: () => run({ apply: false, refetch: false, choices }),
    save: () => run({ apply: true, refetch: false, choices }),
    close: () => run({ close: true }),
  };
}

export type SourceRefresh<Choices, Preview> = ReturnType<typeof useSourceRefresh<Choices, Preview>>;
