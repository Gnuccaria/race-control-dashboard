import { isArticleNumber, type SavedPenalty } from '@shared/penaltyRules';
import type { Messages } from '@/i18n/messages';

/** "Art. 2.4 – Codice di Condotta"; le penalità salvate prima del numero di articolo mostrano il loro testo. */
export const violationLabel = (penalty: Pick<SavedPenalty, 'violation' | 'document'>, messages: Messages): string =>
  isArticleNumber(penalty.violation)
    ? messages.penalties.violationLabel(penalty.violation, messages.penalties.documents[penalty.document])
    : penalty.violation;
