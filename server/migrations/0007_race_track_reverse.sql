-- Gare: la pista può essere percorsa al contrario (solo se la sua configurazione lo prevede).
ALTER TABLE races ADD COLUMN is_track_reversed INTEGER NOT NULL DEFAULT 0 CHECK (is_track_reversed IN (0, 1));
