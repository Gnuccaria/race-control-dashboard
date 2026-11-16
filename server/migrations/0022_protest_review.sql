-- Esito delle proteste deciso dai Commissari Sportivi nell'app: 'open' (in esame) finché non la respingono.
-- La motivazione del rifiuto è facoltativa (al massimo 500 caratteri); la vede l'equipaggio sul sito.
ALTER TABLE protests ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'rejected'));
ALTER TABLE protests ADD COLUMN rejection_reason TEXT CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 500);
ALTER TABLE protests ADD COLUMN reviewed_by_discord_id TEXT;
ALTER TABLE protests ADD COLUMN reviewed_at TEXT;

-- Le proteste si mostrano sul sito anche a chi ha lo stesso ruolo di equipaggio di chi le ha mandate.
CREATE INDEX protests_by_crew_role ON protests (crew_role_id, id);
