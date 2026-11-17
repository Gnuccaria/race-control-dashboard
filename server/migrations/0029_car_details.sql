-- Vetture con gruppo, trasmissione e BoP Midspeed, aggiornate dall'app (catalogo ufficiale GT7 + gt-engine.com).
-- limiter diventa la % Limitatore (potenza BoP / potenza di serie × 100) e ballast_kg la zavorra (peso BoP − peso di
-- serie), che può essere negativa: SQLite non cambia il CHECK di una colonna, quindi si ricrea come nella 0017.
ALTER TABLE cars ADD COLUMN car_group TEXT CHECK (car_group IS NULL OR car_group IN ('Gr.1', 'Gr.2', 'Gr.3', 'Gr.4'));
ALTER TABLE cars ADD COLUMN drivetrain TEXT CHECK (drivetrain IS NULL OR drivetrain IN ('FF', 'FR', 'MR', 'RR', '4WD'));
ALTER TABLE cars ADD COLUMN bop_horsepower INTEGER CHECK (bop_horsepower IS NULL OR bop_horsepower > 0);
ALTER TABLE cars ADD COLUMN bop_weight_kg INTEGER CHECK (bop_weight_kg IS NULL OR bop_weight_kg > 0);
-- Id dell'auto nel catalogo ufficiale ("car102"): così l'aggiornamento ritrova sempre la stessa riga.
ALTER TABLE cars ADD COLUMN source_id TEXT;
CREATE UNIQUE INDEX cars_by_source_id ON cars (source_id) WHERE source_id IS NOT NULL;

ALTER TABLE cars ADD COLUMN ballast_new INTEGER;
UPDATE cars SET ballast_new = ballast_kg;
ALTER TABLE cars DROP COLUMN ballast_kg;
ALTER TABLE cars RENAME COLUMN ballast_new TO ballast_kg;

-- Abbinamenti scelti a mano nell'app tra un'auto del catalogo ufficiale e una di gt-engine (bop_key NULL = nessuna).
CREATE TABLE car_source_matches (
  official_id TEXT PRIMARY KEY,
  bop_key TEXT
);
