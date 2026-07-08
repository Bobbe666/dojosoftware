-- Migration 223: zweiter Check-in-Filter-Toggle (Alter) pro Dojo
ALTER TABLE checkin_einstellungen
  ADD COLUMN IF NOT EXISTS alter_filter_aktiv TINYINT(1) NOT NULL DEFAULT 0;
