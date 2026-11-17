import type { Messages } from '@/i18n/messages';
import { getLastUnexpectedDetail, type ServerErrorKind } from './serverApi';

/** Messaggio di un errore del server; per "errore imprevisto" con il dettaglio dell'ultima risposta imprevista. */
export function serverErrorText(messages: Messages, errorKind: ServerErrorKind): string {
  const detail = errorKind === 'unexpected' ? getLastUnexpectedDetail() : null;
  return detail ? `${messages.serverErrors.unexpected} ${messages.common.errorDetail(detail)}` : messages.serverErrors[errorKind];
}
