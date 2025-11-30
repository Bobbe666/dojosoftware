-- Migration: AGB & Datenschutz Versionierung
-- Datum: 2025-11-30
-- Beschreibung: Fügt Felder für AGB/Datenschutz-Versionierung und Benachrichtigungen hinzu

-- Füge Spalten zur dojo-Tabelle hinzu
ALTER TABLE dojo
ADD COLUMN agb_text TEXT DEFAULT NULL COMMENT 'Aktueller AGB-Text';

ALTER TABLE dojo
ADD COLUMN agb_version VARCHAR(50) DEFAULT '1.0' COMMENT 'AGB-Versionsnummer (z.B. 1.0, 1.1, 2.0)';

ALTER TABLE dojo
ADD COLUMN agb_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der letzten AGB-Änderung';

ALTER TABLE dojo
ADD COLUMN datenschutz_text TEXT DEFAULT NULL COMMENT 'Aktueller Datenschutzerklärungs-Text';

ALTER TABLE dojo
ADD COLUMN datenschutz_version VARCHAR(50) DEFAULT '1.0' COMMENT 'Datenschutz-Versionsnummer';

ALTER TABLE dojo
ADD COLUMN datenschutz_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der letzten Datenschutz-Änderung';

-- Füge Spalten zur mitglieder-Tabelle für Akzeptanz-Tracking hinzu
ALTER TABLE mitglieder
ADD COLUMN agb_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte AGB-Version';

ALTER TABLE mitglieder
ADD COLUMN agb_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der AGB-Akzeptanz';

ALTER TABLE mitglieder
ADD COLUMN datenschutz_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte Datenschutz-Version';

ALTER TABLE mitglieder
ADD COLUMN datenschutz_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der Datenschutz-Akzeptanz';

-- Füge Index für bessere Performance hinzu
ALTER TABLE mitglieder
ADD INDEX idx_agb_version (agb_akzeptiert_version);

ALTER TABLE mitglieder
ADD INDEX idx_datenschutz_version (datenschutz_akzeptiert_version);

-- Zeige Ergebnis
SELECT 'Migration erfolgreich: AGB/Datenschutz-Versionierung hinzugefügt' AS status;
