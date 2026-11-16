-- Piste: ogni configurazione è una pista a sé ("Monza" Full Course e No Chicane), con i suoi dati.
ALTER TABLE tracks ADD COLUMN configuration TEXT CHECK (configuration IS NULL OR length(configuration) BETWEEN 1 AND 64);
ALTER TABLE tracks ADD COLUMN continent TEXT CHECK (continent IS NULL OR length(continent) BETWEEN 1 AND 48);
ALTER TABLE tracks ADD COLUMN length_meters INTEGER CHECK (length_meters IS NULL OR length_meters > 0);
-- 1 = la configurazione si può percorrere anche in senso inverso, 0 = no, NULL = non indicato.
ALTER TABLE tracks ADD COLUMN has_reverse_layout INTEGER CHECK (has_reverse_layout IS NULL OR has_reverse_layout IN (0, 1));

-- name_key ora identifica nome + configurazione ("monza|full course"); le piste già salvate non hanno configurazione.
UPDATE tracks SET name_key = name_key || '|';
