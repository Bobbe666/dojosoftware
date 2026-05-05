-- Migration 148: Dateianhang für Bank-Transaktionen
ALTER TABLE bank_transaktionen
  ADD COLUMN IF NOT EXISTS datei_pfad    VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS datei_name    VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS datei_typ     VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS datei_groesse INT          DEFAULT NULL;
