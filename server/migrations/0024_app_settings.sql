-- Impostazioni generali modificabili dall'app, una riga per impostazione.
-- disconnection_tickets_open: '1' se il sito accetta i ticket di disconnessione, '0' se l'invio è chiuso
-- (interruttore nel Calcolatore disconnessioni, ruolo Direttore Gara). Parte aperto, come prima di questa migrazione.
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_discord_id TEXT
);

INSERT INTO app_settings (key, value) VALUES ('disconnection_tickets_open', '1');
