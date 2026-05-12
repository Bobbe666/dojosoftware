ALTER TABLE bestellvorlagen
  ADD COLUMN IF NOT EXISTS spezifikation TEXT AFTER bemerkungen;
