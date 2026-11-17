import type { TicketAvailability } from '../../../shared/disconnectionTicketRules';
import type { SqlDatabase } from '../database/sqlDatabase';

const SETTING_KEY = 'disconnection_tickets_open';

/** Il sito accetta i ticket? Senza la riga (database non ancora migrato) l'invio resta aperto, come prima. */
export async function readTicketAvailability(database: SqlDatabase): Promise<TicketAvailability> {
  const row = await database.prepare('SELECT value FROM app_settings WHERE key = ?').bind(SETTING_KEY).first<{ value: string }>();
  return { isOpen: row?.value !== '0' };
}

export async function saveTicketAvailability(database: SqlDatabase, availability: TicketAvailability, updatedByDiscordId: string): Promise<TicketAvailability> {
  await database
    .prepare(
      `INSERT INTO app_settings (key, value, updated_by_discord_id) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by_discord_id = excluded.updated_by_discord_id,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(SETTING_KEY, availability.isOpen ? '1' : '0', updatedByDiscordId)
    .run();
  return availability;
}
