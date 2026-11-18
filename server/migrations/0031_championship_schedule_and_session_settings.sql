-- Orario di partenza di ogni durata del campionato ("HH:MM", ora italiana): da qui gli orari degli stint e l'orario
-- proposto alle gare nuove. Le durate salvate prima restano senza (NULL) finché non si modifica il campionato.
ALTER TABLE championship_durations ADD COLUMN start_time TEXT
  CHECK (start_time IS NULL OR (length(start_time) = 5 AND start_time GLOB '[0-2][0-9]:[0-5][0-9]'));

-- Impostazioni di sessione del gioco (gara e qualifica) come JSON, convalidate dal server con
-- shared/sessionSettingsRules.ts. NULL nei campionati salvati prima: si leggono i valori iniziali.
ALTER TABLE championships ADD COLUMN session_settings_json TEXT;
