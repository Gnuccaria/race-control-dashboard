-- Durata sempre obbligatoria e nuova durata "3 hours" (unica dell'All Japan GT Championship).
-- SQLite non cambia il CHECK di una colonna: si crea la colonna nuova, si copiano i valori e si rinomina.
ALTER TABLE races ADD COLUMN duration_new TEXT CHECK (duration_new IS NULL OR duration_new IN ('3 hours', '6 hours', '12 hours'));
UPDATE races SET duration_new = duration;
ALTER TABLE races DROP COLUMN duration;
ALTER TABLE races RENAME COLUMN duration_new TO duration;

-- Le gare dell'All Japan GT Championship salvate senza durata durano 3 ore.
UPDATE races SET duration = '3 hours' WHERE championship = 'All Japan GT Championship' AND duration IS NULL;
