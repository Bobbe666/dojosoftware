-- Migration 201: Zahlungsart am Prüfungstermin speichern
-- Damit die Zulassung die bei der Termin-Erstellung gewählte Zahlungsart (rechnung/lastschrift)
-- übernehmen kann und nicht erneut nachfragt.

ALTER TABLE pruefungstermin_vorlagen
  ADD COLUMN zahlungsart VARCHAR(20) DEFAULT NULL COMMENT 'rechnung | lastschrift | NULL';
