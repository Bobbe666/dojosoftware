-- Migration: MagicLine Zahlungshistorie Felder
-- Fügt Felder für MagicLine-Zahlungshistorie Import hinzu

-- Beiträge-Tabelle: MagicLine-Referenzen
ALTER TABLE beitraege
ADD COLUMN IF NOT EXISTS magicline_transaction_id BIGINT DEFAULT NULL COMMENT 'MagicLine Transaktions-ID',
ADD COLUMN IF NOT EXISTS magicline_description VARCHAR(500) DEFAULT NULL COMMENT 'MagicLine Transaktionsbeschreibung';

-- Index für schnelle Suche und Duplikatsprüfung
CREATE INDEX IF NOT EXISTS idx_magicline_transaction_id ON beitraege(magicline_transaction_id);
