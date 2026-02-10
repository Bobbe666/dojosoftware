-- Migration: vorlage_id in mitglied_dokumente nullable machen
-- Damit SEPA-Mandate-PDFs auch ohne Vorlage gespeichert werden können

ALTER TABLE mitglied_dokumente
MODIFY COLUMN vorlage_id INT(11) NULL DEFAULT NULL;
