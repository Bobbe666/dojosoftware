-- E-Mail-Archiv rechtssicher/vollständig: Absender, CC/BCC, Inhalts-Hash (Integrität).
-- Zeitstempel (gesendet_am) existiert bereits mit DEFAULT current_timestamp().
-- dojo_id NULL-fähig, damit auch System-Mails (ohne Kundenzuordnung) gespeichert werden.
ALTER TABLE dojo_email_archive MODIFY COLUMN dojo_id INT NULL;

ALTER TABLE dojo_email_archive
  ADD COLUMN IF NOT EXISTS absender     VARCHAR(320) NULL AFTER dojo_id,
  ADD COLUMN IF NOT EXISTS kopie_cc     TEXT         NULL AFTER empfaenger_name,
  ADD COLUMN IF NOT EXISTS kopie_bcc    TEXT         NULL AFTER kopie_cc,
  ADD COLUMN IF NOT EXISTS inhalt_hash  CHAR(64)     NULL AFTER message_id;

CREATE INDEX IF NOT EXISTS idx_dea_gesendet ON dojo_email_archive (gesendet_am);
CREATE INDEX IF NOT EXISTS idx_dea_empfaenger ON dojo_email_archive (empfaenger_email);
