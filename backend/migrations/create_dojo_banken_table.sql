-- Migration: Mehrere Bankverbindungen pro Dojo
-- Datum: 2025-01-12
-- Beschreibung: Ermöglicht mehrere Bankverbindungen pro Dojo (verschiedene Konten, Stripe, PayPal)

CREATE TABLE IF NOT EXISTS dojo_banken (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    
    -- Bank-Identifikation
    bank_name VARCHAR(100) NOT NULL COMMENT 'Name der Bank oder Zahlungsanbieter (z.B. Sparkasse, Stripe, PayPal)',
    bank_typ ENUM('bank', 'stripe', 'paypal', 'sonstige') DEFAULT 'bank',
    ist_aktiv BOOLEAN DEFAULT TRUE COMMENT 'Ist diese Bankverbindung aktiv?',
    ist_standard BOOLEAN DEFAULT FALSE COMMENT 'Standard-Konto für Zahlungen',
    
    -- SEPA/Bankdaten
    iban VARCHAR(34) NULL,
    bic VARCHAR(11) NULL,
    kontoinhaber VARCHAR(200) NULL,
    sepa_glaeubiger_id VARCHAR(35) NULL,
    
    -- Stripe
    stripe_publishable_key VARCHAR(255) NULL,
    stripe_secret_key VARCHAR(255) NULL,
    stripe_account_id VARCHAR(100) NULL,
    
    -- PayPal
    paypal_email VARCHAR(255) NULL,
    paypal_client_id VARCHAR(255) NULL,
    paypal_client_secret VARCHAR(255) NULL,
    
    -- Sonstige Zahlungsanbieter
    api_key VARCHAR(255) NULL,
    api_secret VARCHAR(255) NULL,
    merchant_id VARCHAR(100) NULL,
    
    -- Notizen
    notizen TEXT NULL,
    
    -- Reihenfolge für Anzeige
    sortierung INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
    
    -- Indizes
    INDEX idx_dojo_id (dojo_id),
    INDEX idx_bank_typ (bank_typ),
    INDEX idx_ist_aktiv (ist_aktiv)
);

-- Trigger: Nur ein Standard-Konto pro Dojo
DELIMITER $$
CREATE TRIGGER before_dojo_banken_insert
BEFORE INSERT ON dojo_banken
FOR EACH ROW
BEGIN
    IF NEW.ist_standard = TRUE THEN
        UPDATE dojo_banken 
        SET ist_standard = FALSE 
        WHERE dojo_id = NEW.dojo_id;
    END IF;
END$$

CREATE TRIGGER before_dojo_banken_update
BEFORE UPDATE ON dojo_banken
FOR EACH ROW
BEGIN
    IF NEW.ist_standard = TRUE AND OLD.ist_standard = FALSE THEN
        UPDATE dojo_banken 
        SET ist_standard = FALSE 
        WHERE dojo_id = NEW.dojo_id AND id != NEW.id;
    END IF;
END$$
DELIMITER ;

-- Kommentar zur Tabelle
ALTER TABLE dojo_banken COMMENT = 'Mehrere Bankverbindungen und Zahlungsanbieter pro Dojo';

