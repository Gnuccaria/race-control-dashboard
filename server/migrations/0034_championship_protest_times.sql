-- Orari delle qualifiche e finestre delle proteste per campionato (scheda Generale), al posto delle 48 ore fisse:
-- anticipo delle qualifiche sulla gara (ore), durata delle qualifiche (minuti), finestra delle proteste dopo le
-- qualifiche e dopo la gara (ore). Valori da menu fissi, ricontrollati dal server (shared/protestTimingRules.ts).
-- I campionati salvati prima tengono le 48 ore dopo la gara e restano senza qualifiche (NULL) finché non si modificano.
ALTER TABLE championships ADD COLUMN qualifying_advance_hours INTEGER CHECK (qualifying_advance_hours IS NULL OR qualifying_advance_hours BETWEEN 1 AND 168);
ALTER TABLE championships ADD COLUMN qualifying_minutes INTEGER CHECK (qualifying_minutes IS NULL OR qualifying_minutes BETWEEN 1 AND 600);
ALTER TABLE championships ADD COLUMN qualifying_protest_hours INTEGER CHECK (qualifying_protest_hours IS NULL OR qualifying_protest_hours BETWEEN 1 AND 24);
ALTER TABLE championships ADD COLUMN race_protest_hours INTEGER NOT NULL DEFAULT 48 CHECK (race_protest_hours BETWEEN 6 AND 168);
