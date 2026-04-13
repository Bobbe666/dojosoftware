-- Migration 076: created_at + admin_acknowledged_at für Verträge
-- created_at: wird bei neuen Verträgen automatisch gesetzt
-- admin_acknowledged_at: NULL = noch nicht zur Kenntnis genommen

ALTER TABLE vertraege
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admin_acknowledged_at DATETIME NULL DEFAULT NULL;
