-- Migration: Vertragsfrei-Status für Mitglieder
-- Datum: 2025-11-29
-- Beschreibung: Fügt Felder hinzu um Mitglieder als vertragsfrei zu markieren

-- Füge Spalten zur mitglieder-Tabelle hinzu (ohne IF NOT EXISTS für MySQL 8.0 Kompatibilität)
ALTER TABLE mitglieder
ADD COLUMN vertragsfrei TINYINT(1) DEFAULT 0 COMMENT 'Mitglied ist von Vertragspflicht befreit (Ehrenmitglied, Familie, etc.)';

ALTER TABLE mitglieder
ADD COLUMN vertragsfrei_grund VARCHAR(255) DEFAULT NULL COMMENT 'Grund für die Vertragsfreistellung';

-- Füge Index für bessere Performance hinzu
ALTER TABLE mitglieder
ADD INDEX idx_vertragsfrei (vertragsfrei);

-- Zeige Ergebnis
SELECT 'Migration erfolgreich: vertragsfrei und vertragsfrei_grund Spalten hinzugefügt' AS status;
