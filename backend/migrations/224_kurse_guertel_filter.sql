-- Migration 224: Gürtel-Bereich pro Kurs + Gürtel-Filter-Toggle pro Dojo
ALTER TABLE kurse
  ADD COLUMN IF NOT EXISTS min_graduierung_id INT NULL,
  ADD COLUMN IF NOT EXISTS max_graduierung_id INT NULL;
ALTER TABLE checkin_einstellungen
  ADD COLUMN IF NOT EXISTS guertel_filter_aktiv TINYINT(1) NOT NULL DEFAULT 0;
