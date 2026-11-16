-- Penalità decise dalla Direzione Gara per una gara, con le vetture (equipaggi) coinvolte,
-- e penalità dei cambi pilota (solo vettura e penalità totale, in millisecondi).
-- Eliminando una gara se ne eliminano penalità e cambi pilota; un equipaggio coinvolto non si può eliminare.

CREATE TABLE penalties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL REFERENCES races (id) ON DELETE CASCADE,
  violation TEXT NOT NULL CHECK (length(violation) BETWEEN 1 AND 200),
  decision TEXT NOT NULL CHECK (decision IN (
    'no-further-action', 'reprimand', 'time-5', 'time-10', 'time-20', 'time-30', 'time-60', 'time-120', 'time-300',
    'race-disqualification', 'championship-disqualification'
  )),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 2000),
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX penalties_by_race ON penalties (race_id);

CREATE TABLE penalty_crews (
  penalty_id INTEGER NOT NULL REFERENCES penalties (id) ON DELETE CASCADE,
  crew_id INTEGER NOT NULL REFERENCES crews (id) ON DELETE RESTRICT,
  PRIMARY KEY (penalty_id, crew_id)
);

CREATE INDEX penalty_crews_by_crew ON penalty_crews (crew_id);

CREATE TABLE driver_swaps (
  race_id INTEGER NOT NULL REFERENCES races (id) ON DELETE CASCADE,
  crew_id INTEGER NOT NULL REFERENCES crews (id) ON DELETE RESTRICT,
  penalty INTEGER NOT NULL CHECK (penalty BETWEEN 1 AND 86399999),
  PRIMARY KEY (race_id, crew_id)
);

CREATE INDEX driver_swaps_by_crew ON driver_swaps (crew_id);
