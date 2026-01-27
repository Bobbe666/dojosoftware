-- Migration: Verkauf mit Anwesenheit verknuepfen
-- Ermoeglicht die Zuordnung von Verkaeufen zu Check-ins

-- 1. checkin_id Feld hinzufuegen
ALTER TABLE verkaeufe ADD COLUMN IF NOT EXISTS checkin_id INT NULL COMMENT 'Referenz zum Check-in bei dem der Verkauf stattfand';

-- 2. Foreign Key hinzufuegen (falls checkins Tabelle existiert)
-- Erst pruefen ob Constraint nicht existiert
SET @constraint_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_NAME = 'fk_verkaeufe_checkin'
    AND TABLE_NAME = 'verkaeufe'
    AND TABLE_SCHEMA = DATABASE()
);

SET @sql = IF(@constraint_exists = 0,
    'ALTER TABLE verkaeufe ADD CONSTRAINT fk_verkaeufe_checkin FOREIGN KEY (checkin_id) REFERENCES checkins(checkin_id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Index fuer Performance
CREATE INDEX IF NOT EXISTS idx_verkaeufe_checkin_id ON verkaeufe(checkin_id);

-- 4. Kombinierten Index fuer haeufige Abfragen (Mitglied + Check-in)
CREATE INDEX IF NOT EXISTS idx_verkaeufe_mitglied_checkin ON verkaeufe(mitglied_id, checkin_id);
