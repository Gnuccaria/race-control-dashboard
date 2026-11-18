-- Tracciati aggiornati dai siti (Gestisci tracciati → Aggiorna dati) al posto dell'importazione CSV:
-- elenco dal wiki di Gran Turismo, mappe da gt-engine.com per il briefing pre-gara.

-- Nazione (codice ISO a due lettere) al posto del continente.
ALTER TABLE tracks ADD COLUMN country TEXT CHECK (country IS NULL OR (length(country) = 2 AND country GLOB '[A-Z][A-Z]'));
ALTER TABLE tracks DROP COLUMN continent;

-- Mappe di gt-engine.com (nome del file) per il senso normale e, se c'è, per quello inverso.
ALTER TABLE tracks ADD COLUMN map_file TEXT CHECK (map_file IS NULL OR length(map_file) BETWEEN 5 AND 100);
ALTER TABLE tracks ADD COLUMN reverse_map_file TEXT CHECK (reverse_map_file IS NULL OR length(reverse_map_file) BETWEEN 5 AND 100);

-- Chiave della configurazione nel wiki ("autodromo nazionale monza|no chicane"): la ritrova negli aggiornamenti
-- successivi senza perdere le gare collegate. NULL nei tracciati importati prima dal CSV.
ALTER TABLE tracks ADD COLUMN source_key TEXT CHECK (source_key IS NULL OR length(source_key) BETWEEN 1 AND 200);
CREATE UNIQUE INDEX tracks_by_source_key ON tracks (source_key) WHERE source_key IS NOT NULL;

-- Mappe abbinate a mano a una configurazione (NULL = nessuna mappa), ricordate negli aggiornamenti successivi.
CREATE TABLE track_map_matches (
  source_key TEXT PRIMARY KEY CHECK (length(source_key) BETWEEN 1 AND 200),
  map_file TEXT CHECK (map_file IS NULL OR length(map_file) BETWEEN 5 AND 100)
);
