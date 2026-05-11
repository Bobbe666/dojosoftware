-- Geschäftskunden-Felder in mitglieder-Tabelle
ALTER TABLE mitglieder
  ADD COLUMN IF NOT EXISTS ist_firma       TINYINT(1)   NOT NULL DEFAULT 0   AFTER ort,
  ADD COLUMN IF NOT EXISTS firmenname      VARCHAR(200) NULL                  AFTER ist_firma,
  ADD COLUMN IF NOT EXISTS ust_id          VARCHAR(50)  NULL                  AFTER firmenname,
  ADD COLUMN IF NOT EXISTS ansprechpartner VARCHAR(200) NULL                  AFTER ust_id;
