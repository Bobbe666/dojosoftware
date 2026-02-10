-- Migration: Erlaube NULL für dojo_id in lastschrift_zeitplaene
-- Erstellt: 2026-02-10
-- Beschreibung: NULL bedeutet "alle Dojos"

-- Entferne bestehende Foreign Key Constraint
SET @fk_name = (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lastschrift_zeitplaene'
    AND COLUMN_NAME = 'dojo_id'
    AND REFERENCED_TABLE_NAME = 'dojo'
    LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL,
    CONCAT('ALTER TABLE lastschrift_zeitplaene DROP FOREIGN KEY ', @fk_name),
    'SELECT "No FK to drop"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ändere dojo_id auf nullable
ALTER TABLE lastschrift_zeitplaene MODIFY COLUMN dojo_id INT NULL;

-- Füge Foreign Key mit ON DELETE SET NULL hinzu
ALTER TABLE lastschrift_zeitplaene
ADD CONSTRAINT fk_zeitplan_dojo
FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE SET NULL;
