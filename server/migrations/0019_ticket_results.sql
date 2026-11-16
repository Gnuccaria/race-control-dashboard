-- Dettaglio del calcolo del tempo di attesa (giri mancanti, penalità, distacco…), salvato con il risultato:
-- il sito lo mostra a chi ha mandato il ticket. JSON con i campi di TicketResultDetails.
ALTER TABLE disconnection_tickets ADD COLUMN result_json TEXT;
CREATE INDEX disconnection_tickets_by_submitter ON disconnection_tickets (submitted_by_discord_id, id);
