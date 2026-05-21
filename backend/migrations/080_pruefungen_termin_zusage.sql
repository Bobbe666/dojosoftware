-- Migration 080: Alternative Terminvorschläge für Prüfungen
-- Mitglieder können alternative Termine vorschlagen wenn sie am Prüfungsdatum keine Zeit haben
-- Hinweis: mitglied_antwort (kommt/kommt_nicht) existiert bereits

ALTER TABLE pruefungen
  ADD COLUMN alternative_termine JSON DEFAULT NULL COMMENT 'Alternative Datumsvorschläge (Array von YYYY-MM-DD) wenn Mitglied nicht kommen kann';
