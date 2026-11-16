-- Nomi fino a 48 caratteri (con spazi), auto facoltativa, nuovo campo campionato.
-- SQLite non permette di cambiare i vincoli CHECK: si ricrea la tabella copiando i dati.
CREATE TABLE crews_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 48),
  -- Nome in minuscolo con spazi normalizzati: rende unico il nome senza distinguere maiuscole e minuscole.
  name_key TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL UNIQUE CHECK (number BETWEEN 0 AND 999),
  -- NULL = auto non ancora indicata (equipaggi importati senza auto).
  car TEXT CHECK (car IS NULL OR car IN ('Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche')),
  championship TEXT CHECK (championship IS NULL OR length(championship) BETWEEN 1 AND 48),
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO crews_next (id, name, name_key, number, car, championship, created_by_discord_id, created_at)
SELECT id, name, name_key, number, car, NULL, created_by_discord_id, created_at FROM crews;

DROP TABLE crews;
ALTER TABLE crews_next RENAME TO crews;
