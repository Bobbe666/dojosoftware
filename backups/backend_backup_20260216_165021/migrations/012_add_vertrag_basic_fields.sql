-- Migration 012: Füge grundlegende Vertragsfelder hinzu
-- Datum: 2025-10-19
-- Beschreibung: Fügt Vertragsbeginn, Vertragsende, Tarif und Zahlungsinformationen hinzu

SET @dbname = DATABASE();
SET @tablename = 'vertraege';

-- Vertragsbeginn
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'vertragsbeginn';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN vertragsbeginn DATE COMMENT \'Datum des Vertragsbeginns\'',
  'SELECT \'Spalte vertragsbeginn existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vertragsende
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'vertragsende';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN vertragsende DATE COMMENT \'Geplantes Vertragsende (vor automatischer Verlängerung)\'',
  'SELECT \'Spalte vertragsende existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Tarif ID (Referenz)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'tarif_id';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN tarif_id INT COMMENT \'Verknüpfung mit Tarif (falls vorhanden)\'',
  'SELECT \'Spalte tarif_id existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Zahlungsintervall / Billing Cycle
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'billing_cycle';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN billing_cycle VARCHAR(50) COMMENT \'Zahlungsintervall: monatlich, vierteljährlich, halbjährlich, jährlich\'',
  'SELECT \'Spalte billing_cycle existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Zahlungsmethode
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'payment_method';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN payment_method VARCHAR(50) DEFAULT \'direct_debit\' COMMENT \'Zahlungsmethode: direct_debit (SEPA), transfer (Überweisung), bar, etc.\'',
  'SELECT \'Spalte payment_method existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Monatsbeitrag (cached value für schnellen Zugriff)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'monatsbeitrag';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN monatsbeitrag DECIMAL(10,2) COMMENT \'Monatlicher Beitrag (nach Rabatten)\'',
  'SELECT \'Spalte monatsbeitrag existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index für Vertragszeiträume
CREATE INDEX IF NOT EXISTS idx_vertraege_zeitraum ON vertraege(vertragsbeginn, vertragsende);

-- Index für Tarif-Zuordnung
CREATE INDEX IF NOT EXISTS idx_vertraege_tarif ON vertraege(tarif_id);

SELECT '✅ Migration 012 erfolgreich abgeschlossen' AS Status;
