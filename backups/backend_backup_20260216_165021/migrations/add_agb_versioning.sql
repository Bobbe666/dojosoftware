-- Migration: Rechtliche Dokumente Versionierung
-- Datum: 2025-11-30 (erweitert 2026-01-27)
-- Beschreibung: Fuegt Felder fuer AGB/Datenschutz/Dojo-Regeln/Hausordnung Versionierung hinzu
-- Hinweis: Verwendet konsistente Namensgebung mit einstellungendojo.js

-- ============================================================
-- DOJO TABELLE - Versions-Spalten fuer alle Dokumente
-- ============================================================

-- AGB Versionierung
ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS agb_version VARCHAR(50) DEFAULT '1.0' COMMENT 'AGB-Versionsnummer';

ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS agb_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Letzte AGB-Aenderung';

-- DSGVO/Datenschutz Versionierung
ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS dsgvo_version VARCHAR(50) DEFAULT '1.0' COMMENT 'Datenschutz-Versionsnummer';

ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS dsgvo_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Letzte Datenschutz-Aenderung';

-- Dojo-Regeln Versionierung
ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS dojo_regeln_version VARCHAR(50) DEFAULT '1.0' COMMENT 'Dojo-Regeln Versionsnummer';

ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS dojo_regeln_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Letzte Dojo-Regeln Aenderung';

-- Hausordnung Versionierung
ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS hausordnung_version VARCHAR(50) DEFAULT '1.0' COMMENT 'Hausordnung Versionsnummer';

ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS hausordnung_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Letzte Hausordnung Aenderung';

-- ============================================================
-- MITGLIEDER TABELLE - Akzeptanz-Tracking fuer alle Dokumente
-- ============================================================

-- AGB Akzeptanz
ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS agb_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte AGB-Version';

ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS agb_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der AGB-Akzeptanz';

-- DSGVO Akzeptanz
ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS dsgvo_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte Datenschutz-Version';

ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS dsgvo_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der Datenschutz-Akzeptanz';

-- Dojo-Regeln Akzeptanz
ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS dojo_regeln_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte Dojo-Regeln Version';

ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS dojo_regeln_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der Dojo-Regeln Akzeptanz';

-- Hausordnung Akzeptanz
ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS hausordnung_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte Hausordnung Version';

ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS hausordnung_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der Hausordnung Akzeptanz';

-- Import-Bestaetigung (fuer CSV-importierte Mitglieder)
ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS import_bestaetigt BOOLEAN DEFAULT FALSE COMMENT 'Erst-Login Bestaetigung erfolgt';

ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS import_bestaetigt_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der Import-Bestaetigung';

-- ============================================================
-- ERGEBNIS
-- ============================================================
SELECT 'Migration erfolgreich: Rechtliche Dokumente Versionierung hinzugefuegt' AS status;
