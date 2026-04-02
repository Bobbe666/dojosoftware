-- ============================================================================
-- MIGRATION: Teilnahmebestätigung für Prüfungen
-- Datum: 2025-10-16
-- ============================================================================

-- Füge neue Felder zur pruefungen Tabelle hinzu
SET sql_notes = 0;

ALTER TABLE pruefungen
ADD COLUMN teilnahme_bestaetigt BOOLEAN DEFAULT FALSE COMMENT 'Hat das Mitglied die Teilnahme bestätigt?';

ALTER TABLE pruefungen
ADD COLUMN teilnahme_bestaetigt_am DATETIME NULL COMMENT 'Zeitpunkt der Teilnahmebestätigung';

SET sql_notes = 1;

-- Index für schnellere Abfragen nach bestätigten Teilnahmen
CREATE INDEX idx_pruefungen_teilnahme ON pruefungen(teilnahme_bestaetigt, status);

-- Kommentar
-- Diese Migration fügt Felder hinzu, um die Teilnahmebestätigung von Mitgliedern
-- an Prüfungen zu tracken. Mitglieder müssen aktiv bestätigen, dass sie an einer
-- Prüfung teilnehmen möchten und die Teilnahmebedingungen akzeptieren.
