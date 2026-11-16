-- Ordini di arrivo: distacco dal leader (facoltativo), in millisecondi.
-- Nell'app si scrive come minuti:secondi,millesimi (es. 1:05,320 = 65320); massimo 999:59,999.
ALTER TABLE race_results ADD COLUMN gap INTEGER CHECK (gap IS NULL OR gap BETWEEN 0 AND 59999999);
