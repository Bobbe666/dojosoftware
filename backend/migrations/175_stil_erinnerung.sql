-- Stil-Erinnerung: Admin-Flag für "bereits weggeklickt"
ALTER TABLE mitglieder
  ADD COLUMN IF NOT EXISTS stil_erinnerung_dismissed TINYINT(1) NOT NULL DEFAULT 0;
