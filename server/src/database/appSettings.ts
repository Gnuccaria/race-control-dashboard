import type { SqlDatabase } from './sqlDatabase';

/**
 * Impostazioni generali salvate nella tabella app_settings (chiave → testo), con chi le ha cambiate per ultimo:
 * invio dei ticket aperto o chiuso, fonti scaricate dall'ultimo "Aggiorna dati" di vetture e tracciati.
 */

/** Valore salvato; null se la riga non c'è. */
export async function readAppSetting(database: SqlDatabase, key: string): Promise<string | null> {
  const row = await database.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

/** Salva (o sostituisce) il valore. */
export async function saveAppSetting(database: SqlDatabase, key: string, value: string, updatedByDiscordId: string): Promise<void> {
  await database
    .prepare(
      `INSERT INTO app_settings (key, value, updated_by_discord_id) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by_discord_id = excluded.updated_by_discord_id,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(key, value, updatedByDiscordId)
    .run();
}

/** Valore salvato come JSON; null se manca, non si legge o non ha la forma attesa. */
export async function readJsonAppSetting<Value>(database: SqlDatabase, key: string, hasExpectedShape: (value: Value) => boolean): Promise<Value | null> {
  const text = await readAppSetting(database, key);
  if (text === null) return null;
  try {
    const value = JSON.parse(text) as Value;
    return hasExpectedShape(value) ? value : null;
  } catch {
    return null;
  }
}

export const saveJsonAppSetting = (database: SqlDatabase, key: string, value: unknown, updatedByDiscordId: string): Promise<void> =>
  saveAppSetting(database, key, JSON.stringify(value), updatedByDiscordId);
