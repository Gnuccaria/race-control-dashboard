import type { TicketAvailability } from '../../../shared/disconnectionTicketRules';
import { readAppSetting, saveAppSetting } from '../database/appSettings';
import type { SqlDatabase } from '../database/sqlDatabase';

const SETTING_KEY = 'disconnection_tickets_open';

/** Il sito accetta i ticket? Senza la riga (database non ancora migrato) l'invio resta aperto, come prima. */
export async function readTicketAvailability(database: SqlDatabase): Promise<TicketAvailability> {
  return { isOpen: (await readAppSetting(database, SETTING_KEY)) !== '0' };
}

export async function saveTicketAvailability(database: SqlDatabase, availability: TicketAvailability, updatedByDiscordId: string): Promise<TicketAvailability> {
  await saveAppSetting(database, SETTING_KEY, availability.isOpen ? '1' : '0', updatedByDiscordId);
  return availability;
}
