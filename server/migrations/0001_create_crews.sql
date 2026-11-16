-- Equipaggi del campionato. I vincoli replicano le regole di shared/crewRules.ts:
-- anche una scrittura che aggirasse il server non potrebbe salvare dati non validi o duplicati.
CREATE TABLE crews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 32),
  -- Nome in minuscolo: rende unico il nome senza distinguere maiuscole e minuscole.
  name_key TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL UNIQUE CHECK (number BETWEEN 0 AND 999),
  car TEXT NOT NULL CHECK (car IN ('Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche')),
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
