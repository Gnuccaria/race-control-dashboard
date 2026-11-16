-- 1. Il campionato "FIE Cool1" si chiama ora "Cool1 FIE Championship".
UPDATE crews SET championship = 'Cool1 FIE Championship' WHERE championship = 'FIE Cool1';

-- 2. Piste: elenco gestito dal server, usato dalle gare.
CREATE TABLE tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 64),
  -- Nome in minuscolo con spazi normalizzati: due piste non possono avere lo stesso nome.
  name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. Gare: un round per campionato, con data e (per ora facoltativa) pista.
CREATE TABLE races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  championship TEXT NOT NULL CHECK (length(championship) BETWEEN 1 AND 48),
  round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 99),
  track_id INTEGER REFERENCES tracks (id) ON DELETE SET NULL,
  -- Data di svolgimento in formato ISO (AAAA-MM-GG): così si ordina e si filtra come testo.
  race_date TEXT NOT NULL CHECK (race_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (championship, round)
);

CREATE INDEX races_by_date ON races (race_date);

-- 4. Ordine di arrivo: una riga per posizione occupata. Un equipaggio compare al massimo una volta per gara.
--    Eliminando una gara se ne elimina la classifica; un equipaggio presente in una classifica non si può eliminare.
CREATE TABLE race_results (
  race_id INTEGER NOT NULL REFERENCES races (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 14),
  crew_id INTEGER NOT NULL REFERENCES crews (id) ON DELETE RESTRICT,
  PRIMARY KEY (race_id, position),
  UNIQUE (race_id, crew_id)
);

CREATE INDEX race_results_by_crew ON race_results (crew_id);
