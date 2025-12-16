-- =====================================================================================
-- MIGRATION: Aufnahmegebühr zu Tarifen hinzufügen
-- =====================================================================================
-- Fügt eine aufnahmegebuehr_cents Spalte zur tarife-Tabelle hinzu
-- Standard: 4999 Cents (49,99 EUR)
-- =====================================================================================

-- Füge die Spalte hinzu (falls sie noch nicht existiert)
ALTER TABLE tarife ADD COLUMN IF NOT EXISTS aufnahmegebuehr_cents INT NOT NULL DEFAULT 4999 COMMENT 'Aufnahmegebühr in Cents (z.B. 4999 = 49,99 EUR)';

-- Setze bestehende Einträge auf Standardwert falls NULL
UPDATE tarife SET aufnahmegebuehr_cents = 4999 WHERE aufnahmegebuehr_cents IS NULL;

SELECT 'Migration: Aufnahmegebühr zu Tarifen erfolgreich hinzugefügt' AS Status;
