-- Phase 5: mitglied_stile / trainer_stile auf stil_id-FK normalisieren.
-- Ergänzt eine robuste stil_id-Spalte (namensbasierte Kopplung war rename-anfällig).
-- Die Text-Spalte `stil` BLEIBT vorerst (Rückwärtskompatibilität), wird später gedroppt.
-- Backfill dojo-scoped über den Namen. NICHTS wird gelöscht.

-- mitglied_stile: stil_id ergänzen + backfillen (121/122; 1 Legacy 'Karate' Dojo 3 bleibt NULL)
ALTER TABLE mitglied_stile ADD COLUMN stil_id INT NULL DEFAULT NULL AFTER stil;
ALTER TABLE mitglied_stile ADD INDEX idx_ms_stil_id (stil_id);
UPDATE mitglied_stile ms
  JOIN mitglieder m ON m.mitglied_id = ms.mitglied_id
  JOIN stile s ON s.name = ms.stil AND s.dojo_id = m.dojo_id
   SET ms.stil_id = s.stil_id;

-- trainer_stile: stil_id ergänzen + backfillen (Backfill aktuell 0, da Trainer dojo_id=1-Waisen;
-- nach Trainer-Orphan-Fix erneut ausführen: gleiche UPDATE-Query)
ALTER TABLE trainer_stile ADD COLUMN stil_id INT NULL DEFAULT NULL AFTER stil;
ALTER TABLE trainer_stile ADD INDEX idx_ts_stil_id (stil_id);
UPDATE trainer_stile ts
  JOIN trainer t ON t.trainer_id = ts.trainer_id
  JOIN stile s ON s.name = ts.stil AND s.dojo_id = t.dojo_id
   SET ts.stil_id = s.stil_id;
