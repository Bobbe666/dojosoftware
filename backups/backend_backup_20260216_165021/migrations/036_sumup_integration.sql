-- ============================================================================
-- SUMUP INTEGRATION MIGRATION
-- Migration 036: Adds SumUp payment terminal support
-- ============================================================================

-- SumUp Konfiguration in dojo Tabelle (TEXT statt VARCHAR wegen Row Size Limit)
ALTER TABLE dojo
  ADD COLUMN IF NOT EXISTS sumup_api_key TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sumup_merchant_code VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sumup_client_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sumup_client_secret TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sumup_aktiv TINYINT(1) DEFAULT 0;

-- SumUp Transaction ID in verkaeufe Tabelle
ALTER TABLE verkaeufe
  ADD COLUMN IF NOT EXISTS sumup_checkout_id VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sumup_transaction_id VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sumup_receipt_url VARCHAR(500) DEFAULT NULL;

-- SumUp Zahlungen Tabelle (für Tracking aller SumUp Transaktionen)
CREATE TABLE IF NOT EXISTS sumup_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  checkout_id VARCHAR(100) NOT NULL,
  checkout_reference VARCHAR(100) DEFAULT NULL,
  dojo_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  description VARCHAR(255) DEFAULT NULL,
  status ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED') DEFAULT 'PENDING',
  transaction_id VARCHAR(100) DEFAULT NULL,
  transaction_code VARCHAR(50) DEFAULT NULL,
  receipt_url VARCHAR(500) DEFAULT NULL,
  -- Referenzen (optional, je nach Kontext)
  mitglied_id INT DEFAULT NULL,
  rechnung_id INT DEFAULT NULL,
  verkauf_id INT DEFAULT NULL,
  event_anmeldung_id INT DEFAULT NULL,
  verbandsmitgliedschaft_id INT DEFAULT NULL,
  -- Typ der Zahlung
  zahlungstyp ENUM('verkauf', 'mitgliedsbeitrag', 'event', 'verbandsbeitrag', 'rechnung', 'sonstig') DEFAULT 'sonstig',
  -- Metadaten
  checkout_url VARCHAR(500) DEFAULT NULL,
  response_data JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  -- Indizes
  INDEX idx_checkout_id (checkout_id),
  INDEX idx_dojo_id (dojo_id),
  INDEX idx_status (status),
  INDEX idx_mitglied_id (mitglied_id),
  INDEX idx_rechnung_id (rechnung_id),
  INDEX idx_verkauf_id (verkauf_id),
  INDEX idx_created_at (created_at),
  -- Foreign Keys
  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index für schnelle Suche nach Checkout-Referenz
CREATE INDEX IF NOT EXISTS idx_sumup_checkout_ref ON sumup_payments(checkout_reference);

-- Kommentar zur Tabelle
ALTER TABLE sumup_payments COMMENT = 'Tracking aller SumUp Kartenterminal-Zahlungen';
