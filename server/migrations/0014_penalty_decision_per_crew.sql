-- Ogni vettura coinvolta in una penalità ha la sua decisione (facoltativa: NULL = nessuna).
-- "Nessuna azione ulteriore" non è più una decisione: è ciò che il referto scrive quando nessuna vettura ne ha una.
-- Si aggiungono le penalità in griglia (grid-1 … grid-7, posizioni perse nel round successivo).
ALTER TABLE penalty_crews ADD COLUMN decision TEXT CHECK (decision IS NULL OR decision IN (
  'reprimand', 'time-5', 'time-10', 'time-20', 'time-30', 'time-60', 'time-120', 'time-300',
  'grid-1', 'grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6', 'grid-7',
  'race-disqualification', 'championship-disqualification'
));

-- La decisione della penalità passa alle vetture penalizzate.
UPDATE penalty_crews
SET decision = (SELECT penalties.decision FROM penalties WHERE penalties.id = penalty_crews.penalty_id)
WHERE is_penalized = 1
  AND (SELECT penalties.decision FROM penalties WHERE penalties.id = penalty_crews.penalty_id) <> 'no-further-action';

ALTER TABLE penalty_crews DROP COLUMN is_penalized;
ALTER TABLE penalties DROP COLUMN decision;
