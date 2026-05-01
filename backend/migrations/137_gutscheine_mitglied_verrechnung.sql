-- Migration 137: Gutscheine — Mitglied-Verknüpfung + Teilverrechnung

-- Gutscheine: mitglied_id + verbrauchter Betrag
ALTER TABLE gutscheine
  ADD COLUMN IF NOT EXISTS mitglied_id INT NULL
    COMMENT 'Verknüpftes Mitglied (optional)' AFTER empfaenger_email,
  ADD COLUMN IF NOT EXISTS verbraucht_cent INT NOT NULL DEFAULT 0
    COMMENT 'Bereits eingelöster Betrag in Cent' AFTER mitglied_id,
  ADD INDEX IF NOT EXISTS idx_mitglied_id (mitglied_id),
  ADD INDEX IF NOT EXISTS idx_email (empfaenger_email);

-- Verkaeufe: welcher Gutschein wurde verwendet
ALTER TABLE verkaeufe
  ADD COLUMN IF NOT EXISTS gutschein_code VARCHAR(20) NULL
    COMMENT 'Verwendeter Gutschein-Code' AFTER bemerkung,
  ADD COLUMN IF NOT EXISTS gutschein_rabatt_cent INT NOT NULL DEFAULT 0
    COMMENT 'Gutschein-Abzug in Cent' AFTER gutschein_code;
