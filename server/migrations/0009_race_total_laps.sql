-- Gare: numero totale di giri (facoltativo). Nessun equipaggio può averne completati di più.
ALTER TABLE races ADD COLUMN total_laps INTEGER CHECK (total_laps IS NULL OR total_laps BETWEEN 1 AND 999);
