ALTER TABLE rechnungspositionen ADD COLUMN IF NOT EXISTS artikelnummer VARCHAR(100) NULL AFTER bezeichnung;
