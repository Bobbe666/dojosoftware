-- Phase 4/5-Nachzug: Trainer-Waisen zuordnen + Legacy-Stilnamen bereinigen.
-- 6 Trainer haben dojo_id=1 (alter Default, Dojo 1 existiert nicht). Es sind eindeutig
-- Dojo-3-Personal (Schreiner-Familie + bekannte Dojo-3-Trainer). Dojo 4 hat eigene Trainer.
UPDATE trainer SET dojo_id = 3 WHERE dojo_id = 1;

-- trainer_stile stil_id-Backfill nachziehen (jetzt matchen Kickboxen/ShieldX/BJJ zu Dojo 3)
UPDATE trainer_stile ts
  JOIN trainer t ON t.trainer_id = ts.trainer_id
  JOIN stile s ON s.name = ts.stil AND s.dojo_id = t.dojo_id
   SET ts.stil_id = s.stil_id
 WHERE ts.stil_id IS NULL;

-- Legacy 'Karate' → 'Enso Karate' (Dojo 3) in trainer_stile UND mitglied_stile
-- (Dojo 3 hat 'Enso Karate', kein 'Karate' → wäre sonst dauerhaft unaufgelöst)
UPDATE trainer_stile ts
  JOIN trainer t ON t.trainer_id = ts.trainer_id
   SET ts.stil_id = (SELECT stil_id FROM stile WHERE name = 'Enso Karate' AND dojo_id = 3)
 WHERE ts.stil = 'Karate' AND t.dojo_id = 3 AND ts.stil_id IS NULL;

UPDATE mitglied_stile ms
  JOIN mitglieder m ON m.mitglied_id = ms.mitglied_id
   SET ms.stil_id = (SELECT stil_id FROM stile WHERE name = 'Enso Karate' AND dojo_id = 3)
 WHERE ms.stil = 'Karate' AND m.dojo_id = 3 AND ms.stil_id IS NULL;
