-- Colore dell'equipaggio, facoltativo: esadecimale maiuscolo "#RRGGBB" (come normalizeCrewColor in shared/crewRules.ts).
ALTER TABLE crews ADD COLUMN color TEXT
  CHECK (color IS NULL OR (length(color) = 7 AND color GLOB '#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]'));
