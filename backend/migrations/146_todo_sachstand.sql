-- Migration 146: Sachstand-Feld für Todos
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS sachstand TEXT NULL COMMENT 'Bearbeitungsstand / Fortschrittsnotiz'
  AFTER beschreibung;
