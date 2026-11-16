-- Cambi pilota: per ogni cambio e vettura si salvano Pit In, Pit Out (millisecondi), penalità calcolata dal server,
-- annullata e note. Sostituisce la tabella della 0011, che teneva solo la penalità totale per vettura.
DROP TABLE driver_swaps;

CREATE TABLE driver_swaps (
  race_id INTEGER NOT NULL REFERENCES races (id) ON DELETE CASCADE,
  -- 1 = cambio fra stint 1 e 2.
  swap INTEGER NOT NULL CHECK (swap BETWEEN 1 AND 99),
  crew_id INTEGER NOT NULL REFERENCES crews (id) ON DELETE RESTRICT,
  pit_in INTEGER CHECK (pit_in IS NULL OR pit_in BETWEEN 0 AND 359999999),
  pit_out INTEGER CHECK (pit_out IS NULL OR pit_out BETWEEN 0 AND 359999999),
  penalty INTEGER CHECK (penalty IS NULL OR penalty > 0),
  is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0, 1)),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 120),
  PRIMARY KEY (race_id, swap, crew_id)
);

CREATE INDEX driver_swaps_by_crew ON driver_swaps (crew_id);
