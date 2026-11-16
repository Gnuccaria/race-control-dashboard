-- Gare: nome facoltativo e durata (obbligatoria per il Cool1 FIE Championship: 6 o 12 ore).
ALTER TABLE races ADD COLUMN name TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 80);
ALTER TABLE races ADD COLUMN duration TEXT CHECK (duration IS NULL OR duration IN ('6 hours', '12 hours'));

-- Ordini di arrivo: la vettura usata in quella gara, fissata al salvataggio. Se poi l'equipaggio cambia
-- auto, le gare già salvate tengono quella vecchia (un'auto usata in una gara non si può eliminare).
ALTER TABLE race_results ADD COLUMN car_id INTEGER REFERENCES cars (id) ON DELETE RESTRICT;
-- Per le gare già salvate l'unico dato disponibile è l'auto attuale dell'equipaggio.
UPDATE race_results SET car_id = (SELECT crews.car_id FROM crews WHERE crews.id = race_results.crew_id);
CREATE INDEX race_results_by_car ON race_results (car_id);
