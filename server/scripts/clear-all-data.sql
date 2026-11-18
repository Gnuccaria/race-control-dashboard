-- Svuota TUTTE le tabelle del database (equipaggi, gare, campionati, auto, piste, ticket, proteste, impostazioni).
-- Le tabelle restano, con le migrazioni già applicate. Irreversibile: i video delle proteste su R2 non si toccano.
--   npx wrangler d1 execute race-control --remote --file scripts/clear-all-data.sql
-- Prima i dati che dipendono da altri (proteste → penalità → gare → equipaggi → auto), poi il resto.
DELETE FROM protests;
DELETE FROM disconnection_tickets;
DELETE FROM driver_swaps;
DELETE FROM race_weather;
DELETE FROM penalty_crews;
DELETE FROM penalties;
DELETE FROM race_results;
DELETE FROM races;
DELETE FROM crew_championships;
DELETE FROM crews;
DELETE FROM car_championships;
DELETE FROM championship_durations;
DELETE FROM championships;
DELETE FROM cars;
DELETE FROM car_source_matches;
DELETE FROM tracks;
DELETE FROM app_settings;
