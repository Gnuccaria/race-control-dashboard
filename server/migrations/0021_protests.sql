-- Proteste mandate dal sito (chi fa parte del server Discord e ha il ruolo del proprio equipaggio) e lette dai
-- Commissari Sportivi nell'app. Equipaggio coinvolto e altri equipaggi si copiano all'invio, così la protesta
-- resta leggibile anche se gli equipaggi cambiano. Il video caricato sta in R2 (bucket PROTEST_VIDEOS), qui
-- solo la sua chiave, il tipo e la dimensione.
CREATE TABLE protests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crew_id INTEGER NOT NULL,
  crew_number INTEGER NOT NULL,
  crew_name TEXT NOT NULL,
  crew_role_id TEXT,
  championship TEXT,
  stint INTEGER NOT NULL CHECK (stint BETWEEN 1 AND 20),
  lap INTEGER NOT NULL CHECK (lap BETWEEN 1 AND 999),
  corner TEXT NOT NULL CHECK (length(corner) BETWEEN 1 AND 40),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  youtube_video_id TEXT CHECK (youtube_video_id IS NULL OR length(youtube_video_id) = 11),
  -- [{ "id": 3, "number": 44, "name": "Firestarter Project" }, …]
  other_crews_json TEXT NOT NULL DEFAULT '[]',
  video_key TEXT,
  video_content_type TEXT,
  video_size INTEGER,
  submitted_by_discord_id TEXT NOT NULL,
  submitted_by_name TEXT NOT NULL,
  submitted_by_username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX protests_by_submitter ON protests (submitted_by_discord_id, created_at);
