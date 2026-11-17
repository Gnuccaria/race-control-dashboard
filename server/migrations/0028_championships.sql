-- Campionati creati dall'app (Gestione campionati) al posto dell'elenco fisso.
-- Gare (races.championship), equipaggi (crew_championships) e vetture ammesse (car_championships) restano collegati
-- con il nome: rinominare un campionato li aggiorna tutti insieme.
CREATE TABLE championships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 48),
  name_key TEXT NOT NULL UNIQUE,
  created_by_discord_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Da una a tre durate di gara per campionato, ognuna con la durata dello stint (da qui i cambi pilota).
CREATE TABLE championship_durations (
  championship_id INTEGER NOT NULL REFERENCES championships (id) ON DELETE CASCADE,
  hours INTEGER NOT NULL CHECK (hours BETWEEN 1 AND 24),
  stint_minutes INTEGER NOT NULL CHECK (stint_minutes >= 1),
  PRIMARY KEY (championship_id, hours)
);

-- I due campionati di prima, con le durate e i cambi pilota di prima:
-- Cool1 FIE 6 ore (stint 60 min) e 12 ore (stint 120 min) = 5 cambi; All Japan GT 3 ore (stint 90 min) = 1 cambio.
INSERT INTO championships (name, name_key) VALUES
  ('Cool1 FIE Championship', 'cool1 fie championship'),
  ('All Japan GT Championship', 'all japan gt championship');
INSERT INTO championship_durations (championship_id, hours, stint_minutes)
SELECT id, 6, 60 FROM championships WHERE name = 'Cool1 FIE Championship'
UNION ALL SELECT id, 12, 120 FROM championships WHERE name = 'Cool1 FIE Championship'
UNION ALL SELECT id, 3, 90 FROM championships WHERE name = 'All Japan GT Championship';

-- Durata delle gare in ore (prima "6 hours"): una colonna nuova, perché SQLite non cambia il CHECK di una colonna.
ALTER TABLE races ADD COLUMN duration_hours INTEGER CHECK (duration_hours IS NULL OR duration_hours BETWEEN 1 AND 24);
UPDATE races SET duration_hours = CAST(replace(duration, ' hours', '') AS INTEGER) WHERE duration IS NOT NULL;
ALTER TABLE races DROP COLUMN duration;
ALTER TABLE races RENAME COLUMN duration_hours TO duration;
