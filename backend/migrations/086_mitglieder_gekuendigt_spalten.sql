-- Migration 086: gekuendigt + gekuendigt_am Spalten in mitglieder
-- Behebt: Unknown column 'gekuendigt' in checkin.js und anderen Routes

ALTER TABLE mitglieder
  ADD COLUMN IF NOT EXISTS gekuendigt TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gekuendigt_am DATETIME NULL;

-- Bestehende inaktive Mitglieder die bereits ein gekuendigt_am haben synchronisieren
UPDATE mitglieder SET gekuendigt = 1 WHERE aktiv = 0 AND gekuendigt_am IS NOT NULL;
