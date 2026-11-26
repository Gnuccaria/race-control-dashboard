import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import type { BulkDeleteState } from '@/hooks/useBulkDelete';
import { useI18n } from '@/i18n/useI18n';
import { serverErrorText } from '@/services/serverErrorText';

interface BulkDeleteFeedbackProps {
  readonly deleteState: BulkDeleteState;
  /** «3 equipaggi eliminati.»: il testo dell'elenco. */
  readonly deletedText: (deletedCount: number) => string;
}

/** Esito dell'ultima eliminazione di righe selezionate, sopra l'elenco: riuscita (quante) o errore del server. */
export function BulkDeleteFeedback({ deleteState, deletedText }: BulkDeleteFeedbackProps) {
  const { messages } = useI18n();
  if (deleteState.status === 'deleted') return <InlineAlert tone="success">{deletedText(deleteState.deletedCount)}</InlineAlert>;
  if (deleteState.status === 'failed') return <InlineAlert>{serverErrorText(messages, deleteState.errorKind)}</InlineAlert>;
  return null;
}
