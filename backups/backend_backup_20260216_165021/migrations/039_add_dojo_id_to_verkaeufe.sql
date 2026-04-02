-- Migration: dojo_id zu verkaeufe und verkauf_positionen hinzufuegen
-- Damit koennen Verkaeufe pro Dojo getrennt erfasst werden

-- 1. dojo_id zu verkaeufe hinzufuegen
ALTER TABLE verkaeufe ADD COLUMN IF NOT EXISTS dojo_id INT NULL;

-- 2. Foreign Key hinzufuegen (falls tabelle existiert)
-- Erst pruefen ob Constraint nicht existiert
SET @constraint_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_NAME = 'fk_verkaeufe_dojo'
    AND TABLE_NAME = 'verkaeufe'
    AND TABLE_SCHEMA = DATABASE()
);

SET @sql = IF(@constraint_exists = 0,
    'ALTER TABLE verkaeufe ADD CONSTRAINT fk_verkaeufe_dojo FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Index fuer Performance
CREATE INDEX IF NOT EXISTS idx_verkaeufe_dojo_id ON verkaeufe(dojo_id);

-- 4. Bestehende Verkaeufe dem Standard-Dojo zuweisen (falls noch kein dojo_id)
-- Hole das erste aktive Dojo und weise es zu
UPDATE verkaeufe v
JOIN (SELECT MIN(id) as default_dojo_id FROM dojo WHERE ist_aktiv = 1) d ON 1=1
SET v.dojo_id = d.default_dojo_id
WHERE v.dojo_id IS NULL;

-- 5. Kombinierten Index fuer haeufige Abfragen
CREATE INDEX IF NOT EXISTS idx_verkaeufe_dojo_datum ON verkaeufe(dojo_id, verkauf_datum);
