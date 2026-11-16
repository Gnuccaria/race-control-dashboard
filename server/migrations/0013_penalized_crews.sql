-- Vetture a cui va la decisione di una penalità, scelte tra quelle coinvolte.
ALTER TABLE penalty_crews ADD COLUMN is_penalized INTEGER NOT NULL DEFAULT 0 CHECK (is_penalized IN (0, 1));
