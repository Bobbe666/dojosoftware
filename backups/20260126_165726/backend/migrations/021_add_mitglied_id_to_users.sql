-- Migration: mitglied_id zu users-Tabelle hinzufügen
-- Datum: 2025-01-08
-- Zweck: Ermögliche Verlinkung von User-Accounts zu Mitgliedern für öffentliche Registrierung

-- Prüfe ob Spalte bereits existiert und füge sie hinzu falls nicht
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'mitglied_id'
);

-- Spalte hinzufügen nur wenn sie nicht existiert
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN mitglied_id INT DEFAULT NULL AFTER role',
    'SELECT "Column mitglied_id already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index erstellen für schnellere Suche
SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_mitglied_id'
);

SET @sql_index = IF(@index_exists = 0,
    'CREATE INDEX idx_mitglied_id ON users(mitglied_id)',
    'SELECT "Index idx_mitglied_id already exists" AS info'
);

PREPARE stmt_index FROM @sql_index;
EXECUTE stmt_index;
DEALLOCATE PREPARE stmt_index;

-- Foreign Key hinzufügen (optional, nur wenn mitglieder-Tabelle existiert)
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'fk_users_mitglied'
);

SET @sql_fk = IF(@fk_exists = 0 AND @column_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_users_mitglied FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE SET NULL',
    'SELECT "Foreign key already exists or column did not exist" AS info'
);

PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

SELECT 'Migration 021 completed successfully' AS status;
