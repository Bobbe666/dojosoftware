-- Migration: Stripe SEPA Lastschrift Integration
-- Erstellt: 2026-02-03

-- PaymentMethod ID für SEPA in sepa_mandate speichern
ALTER TABLE sepa_mandate
ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_mandate_id VARCHAR(255) DEFAULT NULL;

-- Lastschrift-Batch Tabelle für Stripe-Einzüge
CREATE TABLE IF NOT EXISTS stripe_lastschrift_batch (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(100) UNIQUE NOT NULL,
  dojo_id INT,
  monat INT NOT NULL,
  jahr INT NOT NULL,
  anzahl_transaktionen INT DEFAULT 0,
  erfolgreiche INT DEFAULT 0,
  fehlgeschlagene INT DEFAULT 0,
  gesamtbetrag DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('pending', 'processing', 'completed', 'partial', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_batch_dojo (dojo_id),
  INDEX idx_batch_status (status),
  INDEX idx_batch_monat_jahr (monat, jahr)
);

-- Einzelne Transaktionen pro Mitglied
CREATE TABLE IF NOT EXISTS stripe_lastschrift_transaktion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(100) NOT NULL,
  mitglied_id INT NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  beitrag_ids JSON,
  betrag DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'processing', 'succeeded', 'failed', 'canceled') DEFAULT 'pending',
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  INDEX idx_transaktion_batch (batch_id),
  INDEX idx_transaktion_mitglied (mitglied_id),
  INDEX idx_transaktion_status (status),
  INDEX idx_transaktion_payment_intent (stripe_payment_intent_id),
  FOREIGN KEY (batch_id) REFERENCES stripe_lastschrift_batch(batch_id) ON DELETE CASCADE
);

-- Sicherstellen dass mitglieder.stripe_customer_id existiert
-- (Falls nicht vorhanden, hinzufügen)
SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'mitglieder'
  AND COLUMN_NAME = 'stripe_customer_id'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE mitglieder ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL',
  'SELECT "stripe_customer_id already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
