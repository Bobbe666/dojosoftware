-- Migration: Prüfungswartezeiten zu Stile-Tabelle hinzufügen
-- Beschreibung: Fügt Felder für standardmäßige Wartezeiten zwischen Gürtelprüfungen hinzu
-- Datum: 2025-12-13

USE dojo;

-- Füge neue Spalten zur stile-Tabelle hinzu
ALTER TABLE stile
ADD COLUMN wartezeit_grundstufe INT DEFAULT 3 COMMENT 'Wartezeit in Monaten für Grundstufen-Prüfungen',
ADD COLUMN wartezeit_mittelstufe INT DEFAULT 4 COMMENT 'Wartezeit in Monaten für Mittelstufen-Prüfungen',
ADD COLUMN wartezeit_oberstufe INT DEFAULT 6 COMMENT 'Wartezeit in Monaten für Oberstufen-Prüfungen',
ADD COLUMN wartezeit_schwarzgurt_traditionell BOOLEAN DEFAULT FALSE COMMENT 'Ob traditionelle DAN-Wartezeiten verwendet werden (1. DAN->2. DAN = 2 Jahre, 2. DAN->3. DAN = 3 Jahre, etc.)';

-- Informationsausgabe
SELECT 'Migration erfolgreich: Prüfungswartezeiten-Felder zu stile-Tabelle hinzugefügt' AS Status;
