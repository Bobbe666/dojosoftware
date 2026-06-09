-- Migration 199: Businessplan — Datenquelle (EÜR/BWA) + importierte Positionen
-- ============================================================================
-- aus_buchhaltung=1 kennzeichnet aus der Buchhaltung importierte Positionen.
-- Beim „Aktualisieren" werden nur diese ersetzt, manuell erfasste bleiben erhalten.

ALTER TABLE businessplan_umsatz
  ADD COLUMN aus_buchhaltung TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'aus EÜR/BWA importiert';

ALTER TABLE businessplan_kosten
  ADD COLUMN aus_buchhaltung TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'aus EÜR/BWA importiert';
