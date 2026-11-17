-- Un equipaggio può partecipare a più campionati contemporaneamente, con un'auto per campionato; un'auto è
-- disponibile solo nei campionati indicati nel CSV delle auto. I campionati validi sono quelli di
-- CREW_CHAMPIONSHIPS in shared/crewRules.ts (nessun CHECK qui: per aggiungerne uno basta il codice).

-- Campionati di ogni equipaggio, con la sua auto in quel campionato (null solo negli equipaggi importati da CSV).
CREATE TABLE crew_championships (
  crew_id INTEGER NOT NULL REFERENCES crews (id) ON DELETE CASCADE,
  championship TEXT NOT NULL,
  car_id INTEGER REFERENCES cars (id),
  PRIMARY KEY (crew_id, championship)
);
CREATE INDEX crew_championships_by_championship ON crew_championships (championship, crew_id);
CREATE INDEX crew_championships_by_car ON crew_championships (car_id);

-- Dagli equipaggi di prima: il loro unico campionato (non "None") con la loro auto.
INSERT INTO crew_championships (crew_id, championship, car_id)
SELECT id, championship, car_id FROM crews
WHERE championship IS NOT NULL AND championship <> 'None';

-- Campionati in cui ogni auto si può scegliere: le auto di prima sono tutte del Cool1 FIE Championship.
CREATE TABLE car_championships (
  car_id INTEGER NOT NULL REFERENCES cars (id) ON DELETE CASCADE,
  championship TEXT NOT NULL,
  PRIMARY KEY (car_id, championship)
);
INSERT INTO car_championships (car_id, championship) SELECT id, 'Cool1 FIE Championship' FROM cars;

-- crews.car_id e crews.championship non si usano più (restano solo per non ricreare la tabella).
UPDATE crews SET car_id = NULL, championship = NULL;
