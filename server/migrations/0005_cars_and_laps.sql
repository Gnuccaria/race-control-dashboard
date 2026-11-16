-- 1. Auto: tabella gestita dal server, con i dati tecnici (per ora vuoti tranne il costruttore).
--    PS = potenza, kg = peso, limitatore e zavorra (kg) per il bilanciamento delle prestazioni.
CREATE TABLE cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer TEXT NOT NULL CHECK (length(manufacturer) BETWEEN 1 AND 48),
  model TEXT CHECK (model IS NULL OR length(model) BETWEEN 1 AND 64),
  horsepower INTEGER CHECK (horsepower IS NULL OR horsepower > 0),
  weight_kg INTEGER CHECK (weight_kg IS NULL OR weight_kg > 0),
  limiter REAL CHECK (limiter IS NULL OR limiter >= 0),
  ballast_kg INTEGER CHECK (ballast_kg IS NULL OR ballast_kg >= 0)
);
-- Due auto non possono avere stesso costruttore e modello (senza distinguere maiuscole).
CREATE UNIQUE INDEX cars_by_name ON cars (manufacturer COLLATE NOCASE, IFNULL(model, '') COLLATE NOCASE);

-- Le auto usate finora dagli equipaggi.
INSERT INTO cars (manufacturer) VALUES ('Audi'), ('BMW'), ('Ferrari'), ('Lamborghini'), ('Nissan'), ('Porsche');

-- 2. Gli equipaggi puntano all'auto per id invece che per nome. La tabella non viene ricreata:
--    è collegata agli ordini di arrivo. Si aggiunge la nuova colonna, la si riempie e si toglie la vecchia.
ALTER TABLE crews ADD COLUMN car_id INTEGER REFERENCES cars (id) ON DELETE RESTRICT;
UPDATE crews SET car_id = (SELECT cars.id FROM cars WHERE cars.manufacturer = crews.car AND cars.model IS NULL);
ALTER TABLE crews DROP COLUMN car;

-- 3. Giri completati da ogni equipaggio nell'ordine di arrivo (vuoto per le classifiche già salvate).
ALTER TABLE race_results ADD COLUMN laps INTEGER CHECK (laps IS NULL OR laps BETWEEN 0 AND 999);
