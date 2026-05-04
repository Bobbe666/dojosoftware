-- ============================================================
-- Migration 090: kategorie-Spalten von ENUM auf VARCHAR(100)
-- ============================================================
-- Ermöglicht beliebige Kategorie-Namen ohne neue Migrations-ENUMs.
-- Bestehende Werte bleiben erhalten. Neue Kategorie steuerzahlungen
-- wird damit ebenfalls unterstützt.
-- ============================================================

ALTER TABLE buchhaltung_belege
  MODIFY COLUMN kategorie VARCHAR(100) NULL DEFAULT NULL;

ALTER TABLE bank_transaktionen
  MODIFY COLUMN kategorie VARCHAR(100) NULL DEFAULT NULL;

ALTER TABLE bank_zuordnung_regeln
  MODIFY COLUMN kategorie VARCHAR(100) NOT NULL DEFAULT 'sonstige_kosten';
