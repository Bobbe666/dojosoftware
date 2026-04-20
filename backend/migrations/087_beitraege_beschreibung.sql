-- Migration 087: beschreibung Spalte in beitraege
-- Behebt: Unknown column 'b.beschreibung' in member-payments.js und anderen Routes

ALTER TABLE beitraege
  ADD COLUMN IF NOT EXISTS beschreibung TEXT NULL;
