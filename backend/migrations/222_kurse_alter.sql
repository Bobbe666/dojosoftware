-- Migration 222: Min-/Max-Alter pro Kurs (für Alters-Filter beim Check-in)
ALTER TABLE kurse
  ADD COLUMN IF NOT EXISTS min_alter INT NULL,
  ADD COLUMN IF NOT EXISTS max_alter INT NULL;
