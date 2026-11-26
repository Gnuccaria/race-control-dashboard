import type { SavedCrew } from '@shared/crewRules';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import type { Messages } from '@/i18n/messages';
import { serverErrorText } from '@/services/serverErrorText';

/**
 * Avviso al posto delle tabelle del dettaglio gara (classifica, qualifiche, cambi pilota) finché gli equipaggi non sono
 * caricati: caricamento in corso o errore del server. null quando sono pronti.
 */
export function crewsQueryNotice(crewsQuery: ServerQueryState<SavedCrew[]>, messages: Messages): string | null {
  if (crewsQuery.status === 'loading') return messages.races.form.loadingCrews;
  if (crewsQuery.status === 'failed') return serverErrorText(messages, crewsQuery.errorKind);
  return null;
}
