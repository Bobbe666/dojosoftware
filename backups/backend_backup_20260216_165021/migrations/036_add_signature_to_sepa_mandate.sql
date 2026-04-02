-- Migration: Add digital signature fields to sepa_mandate table
-- Date: 2026-01-27
-- Description: Adds fields for digital signature capture on SEPA mandates

-- Add unterschrift_digital field (Base64 encoded signature image)
ALTER TABLE sepa_mandate
ADD COLUMN unterschrift_digital LONGTEXT
COMMENT 'Base64-kodierte digitale Unterschrift des Mandats';

-- Add unterschrift_datum field (timestamp of signature)
ALTER TABLE sepa_mandate
ADD COLUMN unterschrift_datum DATETIME
COMMENT 'Zeitstempel der digitalen Unterschrift';

-- Add unterschrift_ip field (IP address at time of signature)
ALTER TABLE sepa_mandate
ADD COLUMN unterschrift_ip VARCHAR(45)
COMMENT 'IP-Adresse bei der digitalen Unterschrift';

-- Add signature_hash for integrity verification
ALTER TABLE sepa_mandate
ADD COLUMN unterschrift_hash VARCHAR(64)
COMMENT 'SHA-256 Hash der Unterschrift zur Integritaetspruefung';

-- Add index for signed mandates (optional, for reporting)
CREATE INDEX idx_sepa_mandate_unterschrift ON sepa_mandate (unterschrift_datum);
