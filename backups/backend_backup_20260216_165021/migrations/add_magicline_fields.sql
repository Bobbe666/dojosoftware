-- Migration: MagicLine Import Felder
-- Fügt Felder für MagicLine-Import hinzu

-- Mitglieder-Tabelle: MagicLine-Referenzen
ALTER TABLE mitglieder
ADD COLUMN IF NOT EXISTS magicline_customer_number VARCHAR(50) DEFAULT NULL COMMENT 'MagicLine Kundennummer (z.B. M-5)',
ADD COLUMN IF NOT EXISTS magicline_uuid VARCHAR(255) DEFAULT NULL COMMENT 'MagicLine UUID für eindeutige Zuordnung';

-- Index für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_magicline_customer_number ON mitglieder(magicline_customer_number);
CREATE INDEX IF NOT EXISTS idx_magicline_uuid ON mitglieder(magicline_uuid);

-- Verträge-Tabelle: MagicLine-Referenzen
ALTER TABLE vertraege
ADD COLUMN IF NOT EXISTS magicline_contract_id BIGINT DEFAULT NULL COMMENT 'MagicLine Vertrags-ID',
ADD COLUMN IF NOT EXISTS magicline_rate_term VARCHAR(50) DEFAULT NULL COMMENT 'MagicLine Vertragslaufzeit (z.B. 12M)',
ADD COLUMN IF NOT EXISTS magicline_payment_run_group VARCHAR(255) DEFAULT NULL COMMENT 'MagicLine Zahlungslauf-Gruppe';

-- Index für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_magicline_contract_id ON vertraege(magicline_contract_id);

-- Mitglieder-Dokumente Tabelle (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS mitglieder_dokumente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  dateiname VARCHAR(255) NOT NULL,
  dateipfad VARCHAR(500) NOT NULL,
  dokumenttyp VARCHAR(100) DEFAULT NULL COMMENT 'z.B. vertrag, sepa_mandat, import_magicline',
  hochgeladen_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
