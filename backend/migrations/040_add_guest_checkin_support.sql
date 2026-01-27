-- Migration: Gast-Check-in Support
-- Ermoeglicht Check-ins fuer Gaeste (Probetraining, Besucher)

-- 1. mitglied_id auf NULL erlauben (fuer Gaeste)
ALTER TABLE checkins MODIFY COLUMN mitglied_id INT NULL;

-- 2. stundenplan_id auf NULL erlauben (fuer freies Training)
ALTER TABLE checkins MODIFY COLUMN stundenplan_id INT NULL;

-- 3. Gast-spezifische Felder hinzufuegen
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS ist_gast TINYINT(1) DEFAULT 0 COMMENT 'True wenn Gast-Check-in';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS gast_vorname VARCHAR(100) NULL COMMENT 'Vorname des Gastes';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS gast_nachname VARCHAR(100) NULL COMMENT 'Nachname des Gastes';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS gast_email VARCHAR(255) NULL COMMENT 'E-Mail des Gastes (optional)';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS gast_telefon VARCHAR(50) NULL COMMENT 'Telefon des Gastes (optional)';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS gast_grund ENUM('probetraining', 'besucher', 'einmalig', 'sonstiges') DEFAULT 'probetraining' COMMENT 'Grund des Gast-Besuchs';

-- 4. Index fuer Gast-Abfragen
CREATE INDEX IF NOT EXISTS idx_checkins_ist_gast ON checkins(ist_gast);
CREATE INDEX IF NOT EXISTS idx_checkins_gast_name ON checkins(gast_nachname, gast_vorname);

-- 5. Bestehende Daten: Alle vorhandenen Check-ins als Nicht-Gast markieren
UPDATE checkins SET ist_gast = 0 WHERE ist_gast IS NULL;
