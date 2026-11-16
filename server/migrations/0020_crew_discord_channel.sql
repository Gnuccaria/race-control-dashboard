-- Canale Discord dell'equipaggio (facoltativo): dove il bot "Michael Masi" scrive il risultato dei ticket di
-- disconnessione. È l'ID del canale (17–20 cifre), come normalizeDiscordChannelId in shared/crewRules.ts.
ALTER TABLE crews ADD COLUMN discord_channel_id TEXT
  CHECK (discord_channel_id IS NULL OR (length(discord_channel_id) BETWEEN 17 AND 20 AND discord_channel_id NOT GLOB '*[^0-9]*'));

-- Ruolo Discord dell'equipaggio di chi ha mandato il ticket (es. "#16 Vez Team Lime"): il bot lo menziona nel
-- messaggio con il risultato. Vuoto per i ticket mandati prima di questa migrazione.
ALTER TABLE disconnection_tickets ADD COLUMN crew_role_id TEXT;
