-- ============================================================================
-- MIGRATION: Erweiterte Prüfungsdetails
-- Datum: 2025-10-16
-- ============================================================================

-- Füge neue Felder zur pruefungen Tabelle hinzu für vollständige Prüfungsdetails
-- Überspringe Fehler falls Spalten bereits existieren
SET sql_notes = 0;

ALTER TABLE pruefungen
ADD COLUMN pruefungszeit TIME DEFAULT '10:00:00' COMMENT 'Uhrzeit der Prüfung';

ALTER TABLE pruefungen
ADD COLUMN anmeldefrist DATE NULL COMMENT 'Anmeldefrist für die Prüfung';

ALTER TABLE pruefungen
ADD COLUMN gurtlaenge VARCHAR(50) NULL COMMENT 'Empfohlene Gurtlänge (z.B. 260 cm)';

ALTER TABLE pruefungen
ADD COLUMN bemerkungen TEXT NULL COMMENT 'Allgemeine Bemerkungen zur Prüfung';

ALTER TABLE pruefungen
ADD COLUMN teilnahmebedingungen TEXT NULL COMMENT 'Teilnahmebedingungen für die Prüfung';

SET sql_notes = 1;

-- Index für schnellere Abfragen nach Anmeldefrist
CREATE INDEX idx_pruefungen_anmeldefrist ON pruefungen(anmeldefrist);

-- Kommentar
-- Diese Migration fügt Felder hinzu, um vollständige Prüfungsdetails zu speichern:
-- - pruefungszeit: Uhrzeit der Prüfung
-- - anmeldefrist: Deadline für die Anmeldung
-- - gurtlaenge: Empfohlene Gurtlänge
-- - bemerkungen: Allgemeine Hinweise (getrennt von anmerkungen)
-- - teilnahmebedingungen: Bedingungen die Mitglieder akzeptieren müssen
