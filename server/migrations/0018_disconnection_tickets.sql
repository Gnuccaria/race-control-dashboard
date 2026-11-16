-- Ticket di disconnessione mandati dal sito (chi fa parte del server Discord della lega) e gestiti
-- nell'app dalla Direzione Gara. Il numero del ticket è l'id. Numero e nome dell'equipaggio si copiano
-- all'invio, così il ticket resta leggibile anche se l'equipaggio cambia o viene eliminato.
CREATE TABLE disconnection_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crew_id INTEGER NOT NULL,
  crew_number INTEGER NOT NULL,
  crew_name TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 14),
  gap_ms INTEGER NOT NULL CHECK (gap_ms >= 0),
  disconnected_on_lap INTEGER NOT NULL CHECK (disconnected_on_lap BETWEEN 0 AND 999),
  submitted_by_discord_id TEXT NOT NULL,
  submitted_by_name TEXT NOT NULL,
  submitted_by_username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- 'open' finché la Direzione Gara non invia il risultato dal calcolatore.
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  waiting_time_ms INTEGER,
  resolved_by_discord_id TEXT,
  resolved_at TEXT
);

CREATE INDEX disconnection_tickets_open ON disconnection_tickets (status, id);
