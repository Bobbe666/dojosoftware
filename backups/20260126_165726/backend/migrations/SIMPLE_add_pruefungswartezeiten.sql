-- EINFACHE Migration: Prüfungswartezeiten zu Stile-Tabelle hinzufügen
-- Ausführen auf dem Server mit: mysql -u root -p dojo < SIMPLE_add_pruefungswartezeiten.sql

USE dojo;

-- Füge neue Spalten zur stile-Tabelle hinzu (nur wenn sie noch nicht existieren)
ALTER TABLE stile
ADD COLUMN wartezeit_grundstufe INT DEFAULT 3 COMMENT 'Wartezeit in Monaten für Grundstufen-Prüfungen',
ADD COLUMN wartezeit_mittelstufe INT DEFAULT 4 COMMENT 'Wartezeit in Monaten für Mittelstufen-Prüfungen',
ADD COLUMN wartezeit_oberstufe INT DEFAULT 6 COMMENT 'Wartezeit in Monaten für Oberstufen-Prüfungen',
ADD COLUMN wartezeit_schwarzgurt_traditionell TINYINT(1) DEFAULT 0 COMMENT 'Ob traditionelle DAN-Wartezeiten verwendet werden';

-- Zeige Erfolg an
SELECT 'Migration erfolgreich: Prüfungswartezeiten-Felder zu stile-Tabelle hinzugefügt' AS Status;

-- Zeige Tabellen-Struktur
DESCRIBE stile;
