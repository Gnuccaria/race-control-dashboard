-- Sessione di una protesta: 'qualifying' o 'race', decisa dal server dall'orario di invio (le due finestre del
-- campionato non si sovrappongono). Le proteste di qualifica non hanno lo stint, quindi stint diventa facoltativo.
-- SQLite non permette di cambiare il CHECK o il NOT NULL di una colonna: la tabella si ricrea copiando i dati
-- (le proteste mandate prima sono tutte di gara).
CREATE TABLE protests_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crew_id INTEGER NOT NULL,
  crew_number INTEGER NOT NULL,
  crew_name TEXT NOT NULL,
  crew_role_id TEXT,
  championship TEXT,
  race_id INTEGER REFERENCES races (id) ON DELETE SET NULL,
  session TEXT NOT NULL DEFAULT 'race' CHECK (session IN ('qualifying', 'race')),
  stint INTEGER CHECK (stint IS NULL OR stint BETWEEN 1 AND 20),
  lap INTEGER NOT NULL CHECK (lap BETWEEN 1 AND 999),
  corner TEXT NOT NULL CHECK (length(corner) BETWEEN 1 AND 40),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  youtube_video_id TEXT CHECK (youtube_video_id IS NULL OR length(youtube_video_id) = 11),
  other_crews_json TEXT NOT NULL DEFAULT '[]',
  video_key TEXT,
  video_content_type TEXT,
  video_size INTEGER,
  submitted_by_discord_id TEXT NOT NULL,
  submitted_by_name TEXT NOT NULL,
  submitted_by_username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'rejected', 'accepted')),
  rejection_reason TEXT CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 500),
  penalty_id INTEGER REFERENCES penalties (id) ON DELETE SET NULL,
  reviewed_by_discord_id TEXT,
  reviewed_at TEXT,
  CHECK ((session = 'race' AND stint IS NOT NULL) OR (session = 'qualifying' AND stint IS NULL))
);

INSERT INTO protests_new (
  id, crew_id, crew_number, crew_name, crew_role_id, championship, race_id, session, stint, lap, corner, description, youtube_video_id,
  other_crews_json, video_key, video_content_type, video_size, submitted_by_discord_id, submitted_by_name,
  submitted_by_username, created_at, status, rejection_reason, penalty_id, reviewed_by_discord_id, reviewed_at
)
SELECT
  id, crew_id, crew_number, crew_name, crew_role_id, championship, race_id, 'race', stint, lap, corner, description, youtube_video_id,
  other_crews_json, video_key, video_content_type, video_size, submitted_by_discord_id, submitted_by_name,
  submitted_by_username, created_at, status, rejection_reason, penalty_id, reviewed_by_discord_id, reviewed_at
FROM protests;

DROP TABLE protests;
ALTER TABLE protests_new RENAME TO protests;

CREATE INDEX protests_by_submitter ON protests (submitted_by_discord_id, created_at);
CREATE INDEX protests_by_crew_role ON protests (crew_role_id, id);
CREATE INDEX protests_by_race ON protests (race_id);
