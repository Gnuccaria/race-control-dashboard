-- Pattern meteo di ogni gara (Crea pattern meteo, Direttore Gara), mostrato nella scheda Meteo del sito.
-- pattern: JSON { "qualifying": [2 codici], "stints": [[9 codici], …] } (shared/weatherRules.ts).
CREATE TABLE race_weather (
  race_id INTEGER PRIMARY KEY REFERENCES races (id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  updated_by_discord_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
