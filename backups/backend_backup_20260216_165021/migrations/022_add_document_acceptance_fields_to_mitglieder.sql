-- Migration: Dokument-Akzeptanzfelder zur mitglieder-Tabelle hinzufügen
-- Datum: 2025-11-01
-- Zweck: Dokumentakzeptanzen auch in mitglieder-Tabelle speichern (für Auswertungen)
--        Verträge bleiben die "Source of Truth" für rechtliche Nachweise,
--        aber mitglieder-Tabelle bekommt Kopien für einfachere Auswertungen

-- AGB Akzeptanz
SET @column_exists_1 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'agb_akzeptiert'
);

SET @sql_1 = IF(@column_exists_1 = 0,
    'ALTER TABLE mitglieder ADD COLUMN agb_akzeptiert BOOLEAN DEFAULT FALSE COMMENT \'AGB akzeptiert (Kopie aus Vertrag für Auswertungen)\'',
    'SELECT \'Column agb_akzeptiert already exists\' AS info'
);

PREPARE stmt_1 FROM @sql_1;
EXECUTE stmt_1;
DEALLOCATE PREPARE stmt_1;

-- AGB Akzeptanz Datum
SET @column_exists_2 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'agb_akzeptiert_am'
);

SET @sql_2 = IF(@column_exists_2 = 0,
    'ALTER TABLE mitglieder ADD COLUMN agb_akzeptiert_am DATETIME DEFAULT NULL COMMENT \'Zeitpunkt der AGB-Akzeptanz\'',
    'SELECT \'Column agb_akzeptiert_am already exists\' AS info'
);

PREPARE stmt_2 FROM @sql_2;
EXECUTE stmt_2;
DEALLOCATE PREPARE stmt_2;

-- Haftungsausschluss
SET @column_exists_3 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'haftungsausschluss_akzeptiert'
);

SET @sql_3 = IF(@column_exists_3 = 0,
    'ALTER TABLE mitglieder ADD COLUMN haftungsausschluss_akzeptiert BOOLEAN DEFAULT FALSE COMMENT \'Haftungsausschluss akzeptiert\'',
    'SELECT \'Column haftungsausschluss_akzeptiert already exists\' AS info'
);

PREPARE stmt_3 FROM @sql_3;
EXECUTE stmt_3;
DEALLOCATE PREPARE stmt_3;

-- Haftungsausschluss Datum
SET @column_exists_4 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'haftungsausschluss_datum'
);

SET @sql_4 = IF(@column_exists_4 = 0,
    'ALTER TABLE mitglieder ADD COLUMN haftungsausschluss_datum DATETIME DEFAULT NULL COMMENT \'Zeitpunkt der Haftungsausschluss-Akzeptanz\'',
    'SELECT \'Column haftungsausschluss_datum already exists\' AS info'
);

PREPARE stmt_4 FROM @sql_4;
EXECUTE stmt_4;
DEALLOCATE PREPARE stmt_4;

-- Gesundheitserklärung
SET @column_exists_5 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'gesundheitserklaerung'
);

SET @sql_5 = IF(@column_exists_5 = 0,
    'ALTER TABLE mitglieder ADD COLUMN gesundheitserklaerung BOOLEAN DEFAULT FALSE COMMENT \'Gesundheitserklärung abgegeben\'',
    'SELECT \'Column gesundheitserklaerung already exists\' AS info'
);

PREPARE stmt_5 FROM @sql_5;
EXECUTE stmt_5;
DEALLOCATE PREPARE stmt_5;

-- Gesundheitserklärung Datum
SET @column_exists_6 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'gesundheitserklaerung_datum'
);

SET @sql_6 = IF(@column_exists_6 = 0,
    'ALTER TABLE mitglieder ADD COLUMN gesundheitserklaerung_datum DATETIME DEFAULT NULL COMMENT \'Zeitpunkt der Gesundheitserklärung\'',
    'SELECT \'Column gesundheitserklaerung_datum already exists\' AS info'
);

PREPARE stmt_6 FROM @sql_6;
EXECUTE stmt_6;
DEALLOCATE PREPARE stmt_6;

-- Hausordnung akzeptiert Datum
SET @column_exists_7 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'hausordnung_akzeptiert_am'
);

SET @sql_7 = IF(@column_exists_7 = 0,
    'ALTER TABLE mitglieder ADD COLUMN hausordnung_akzeptiert_am DATETIME DEFAULT NULL COMMENT \'Zeitpunkt der Hausordnungs-Akzeptanz\'',
    'SELECT \'Column hausordnung_akzeptiert_am already exists\' AS info'
);

PREPARE stmt_7 FROM @sql_7;
EXECUTE stmt_7;
DEALLOCATE PREPARE stmt_7;

-- Datenschutz akzeptiert Datum
SET @column_exists_8 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'datenschutz_akzeptiert_am'
);

SET @sql_8 = IF(@column_exists_8 = 0,
    'ALTER TABLE mitglieder ADD COLUMN datenschutz_akzeptiert_am DATETIME DEFAULT NULL COMMENT \'Zeitpunkt der Datenschutz-Akzeptanz\'',
    'SELECT \'Column datenschutz_akzeptiert_am already exists\' AS info'
);

PREPARE stmt_8 FROM @sql_8;
EXECUTE stmt_8;
DEALLOCATE PREPARE stmt_8;

-- Foto-Einverständnis Datum
SET @column_exists_9 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitglieder'
    AND COLUMN_NAME = 'foto_einverstaendnis_datum'
);

SET @sql_9 = IF(@column_exists_9 = 0,
    'ALTER TABLE mitglieder ADD COLUMN foto_einverstaendnis_datum DATETIME DEFAULT NULL COMMENT \'Zeitpunkt des Foto-Einverständnisses\'',
    'SELECT \'Column foto_einverstaendnis_datum already exists\' AS info'
);

PREPARE stmt_9 FROM @sql_9;
EXECUTE stmt_9;
DEALLOCATE PREPARE stmt_9;

SELECT 'Migration 022 completed successfully - Document acceptance fields added to mitglieder table' AS status;
