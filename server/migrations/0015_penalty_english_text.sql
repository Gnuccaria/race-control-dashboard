-- Traduzione inglese di violazione e motivazione, per il referto in inglese.
-- english_source: NULL = nessuna traduzione (non ancora fatta o non riuscita), 'automatic' = Workers AI,
-- 'manual' = scritta o corretta a mano; english_outdated = 1 quando, dopo una correzione a mano, è cambiato
-- il testo originale e la traduzione va ricontrollata.
ALTER TABLE penalties ADD COLUMN violation_en TEXT CHECK (violation_en IS NULL OR length(violation_en) BETWEEN 1 AND 300);
ALTER TABLE penalties ADD COLUMN reason_en TEXT CHECK (reason_en IS NULL OR length(reason_en) <= 3000);
ALTER TABLE penalties ADD COLUMN english_source TEXT CHECK (english_source IS NULL OR english_source IN ('automatic', 'manual'));
ALTER TABLE penalties ADD COLUMN english_outdated INTEGER NOT NULL DEFAULT 0 CHECK (english_outdated IN (0, 1));
