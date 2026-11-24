-- Qualifiche di una gara (scheda Qualifiche nell'app e nel sito): come l'ordine di arrivo, una riga per posizione
-- occupata (1–14) con l'equipaggio e la vettura usata, ma con il miglior giro in Q1 e in Q2 (millisecondi, facoltativi)
-- al posto di giri e distacco. Il Q2 c'è solo nelle posizioni 1–4 e 8–11.
CREATE TABLE race_qualifying (
  race_id INTEGER NOT NULL REFERENCES races (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 14),
  crew_id INTEGER NOT NULL REFERENCES crews (id) ON DELETE RESTRICT,
  car_id INTEGER REFERENCES cars (id) ON DELETE SET NULL,
  q1_ms INTEGER CHECK (q1_ms IS NULL OR q1_ms BETWEEN 1 AND 3599999),
  q2_ms INTEGER CHECK (q2_ms IS NULL OR (q2_ms BETWEEN 1 AND 3599999 AND (position BETWEEN 1 AND 4 OR position BETWEEN 8 AND 11))),
  PRIMARY KEY (race_id, position),
  UNIQUE (race_id, crew_id)
);

CREATE INDEX race_qualifying_by_crew ON race_qualifying (crew_id);
