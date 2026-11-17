-- Orari delle gare, in ora italiana (Europe/Rome, shared/raceSchedule.ts): ora di inizio (la data di inizio è race_date),
-- data e ora di fine. Obbligatori dall'app e dall'API; vuoti nelle gare salvate prima di questa migrazione.
-- Le proteste per una gara si mandano dall'ora di inizio fino a 48 ore dopo l'ora di fine: l'interruttore
-- races.accepts_protests (migrazione 0025) non si usa più e resta solo per non ricreare la tabella.
ALTER TABLE races ADD COLUMN start_time TEXT CHECK (start_time IS NULL OR start_time GLOB '[0-2][0-9]:[0-5][0-9]');
ALTER TABLE races ADD COLUMN end_date TEXT CHECK (end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]');
ALTER TABLE races ADD COLUMN end_time TEXT CHECK (end_time IS NULL OR end_time GLOB '[0-2][0-9]:[0-5][0-9]');
