-- Migration: Lastschrift-Zeitplaene an Gruppen koppeln
-- Erstellt: 2026-06-23
-- Beschreibung: Optionaler Gruppen-Filter pro Zeitplan.
--   gruppe_key = NULL  -> Lauf zieht ALLE Gruppen ein (rueckwaertskompatibel,
--                          bestehende Zeitplaene verhalten sich unveraendert).
--   gruppe_key = 'xyz' -> Lauf zieht nur Mitglieder dieser Gruppe ein;
--                          ausfuehrungstag entspricht dem einzugstag der Gruppe.

ALTER TABLE lastschrift_zeitplaene
    ADD COLUMN gruppe_key VARCHAR(50) DEFAULT NULL AFTER dojo_id,
    ADD INDEX idx_zeitplan_gruppe (dojo_id, gruppe_key);
