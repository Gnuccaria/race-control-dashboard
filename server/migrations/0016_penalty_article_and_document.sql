-- La violazione diventa il numero dell'articolo (solo cifre e punti) e si aggiunge il documento del regolamento:
-- il referto scrive la frase fissa "Violazione dell'art. 2.4 del C.d.C." / "Breach of Art. 2.4 of the C. C.".
-- Si traduce in inglese solo la motivazione, quindi violation_en non serve più.
ALTER TABLE penalties ADD COLUMN document TEXT NOT NULL DEFAULT 'code-of-conduct'
  CHECK (document IN ('code-of-conduct', 'technical-regulations'));

UPDATE penalties SET document = 'technical-regulations' WHERE violation LIKE '%Reg.%Tec%' OR violation LIKE '%Regolamento Tecnico%';

-- "Violazione dell'art. 2.4 del C.d.C." → "2.4"; i testi in altra forma restano come sono (il referto li mostra
-- così, l'app chiede di correggerli alla prossima modifica).
UPDATE penalties
SET violation = trim(substr(substr(violation, instr(violation, 'art. ') + 5), 1, instr(substr(violation, instr(violation, 'art. ') + 5), ' del') - 1))
WHERE instr(violation, 'art. ') > 0
  AND instr(substr(violation, instr(violation, 'art. ') + 5), ' del') > 1
  AND trim(substr(substr(violation, instr(violation, 'art. ') + 5), 1, instr(substr(violation, instr(violation, 'art. ') + 5), ' del') - 1)) NOT GLOB '*[^0-9.]*'
  AND trim(substr(substr(violation, instr(violation, 'art. ') + 5), 1, instr(substr(violation, instr(violation, 'art. ') + 5), ' del') - 1)) GLOB '[0-9]*';

ALTER TABLE penalties DROP COLUMN violation_en;
