-- ==========================================
-- Dual Payment System Migration
-- Fügt Stripe + DATEV Integration hinzu
-- Behält manuelle SEPA-Abwicklung bei
-- ==========================================

-- 1. Erweitere dojo Tabelle für Payment Provider Konfiguration
ALTER TABLE dojo
ADD COLUMN payment_provider ENUM('manual_sepa', 'stripe_datev') DEFAULT 'manual_sepa' COMMENT 'Gewähltes Zahlungssystem',
ADD COLUMN stripe_secret_key VARCHAR(255) NULL COMMENT 'Stripe Secret Key (verschlüsselt)',
ADD COLUMN stripe_publishable_key VARCHAR(255) NULL COMMENT 'Stripe Publishable Key',
ADD COLUMN datev_api_key VARCHAR(255) NULL COMMENT 'DATEV API Key (verschlüsselt)',
ADD COLUMN datev_consultant_number VARCHAR(20) NULL COMMENT 'DATEV Beraternummer',
ADD COLUMN datev_client_number VARCHAR(20) NULL COMMENT 'DATEV Mandantennummer';

-- 2. Stripe Payment Intents Tabelle
CREATE TABLE stripe_payment_intents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL COMMENT 'Stripe Payment Intent ID',
    amount INT NOT NULL COMMENT 'Betrag in Cent',
    currency VARCHAR(3) DEFAULT 'EUR',
    status ENUM(
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
        'requires_capture',
        'canceled',
        'succeeded',
        'failed'
    ) NOT NULL DEFAULT 'requires_payment_method',
    mandate_reference VARCHAR(50) NULL COMMENT 'SEPA Mandatsreferenz für Stripe',
    payment_method_id VARCHAR(255) NULL COMMENT 'Stripe Payment Method ID',
    invoice_reference VARCHAR(100) NULL COMMENT 'Rechnungsreferenz',
    description TEXT NULL,
    metadata JSON NULL COMMENT 'Zusätzliche Stripe Metadaten',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
    INDEX idx_stripe_payment_intent (stripe_payment_intent_id),
    INDEX idx_mitglied_status (mitglied_id, status),
    INDEX idx_created_at (created_at)
) COMMENT='Stripe Payment Intents für SEPA Lastschriften';

-- 3. DATEV Export Log Tabelle
CREATE TABLE datev_exports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_intent_id INT NOT NULL,
    export_type ENUM('booking', 'customer', 'invoice') DEFAULT 'booking',
    datev_booking_id VARCHAR(100) NULL COMMENT 'DATEV Buchungs-ID',
    datev_response JSON NULL COMMENT 'Vollständige DATEV API Response',
    export_status ENUM('pending', 'processing', 'success', 'failed', 'retry') DEFAULT 'pending',
    error_message TEXT NULL,
    retry_count INT DEFAULT 0,
    account_from VARCHAR(10) NULL COMMENT 'Soll-Konto (z.B. 1200 Debitor)',
    account_to VARCHAR(10) NULL COMMENT 'Haben-Konto (z.B. 1000 Bank)',
    booking_text VARCHAR(255) NULL COMMENT 'Buchungstext',
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_intent_id) REFERENCES stripe_payment_intents(id) ON DELETE CASCADE,
    INDEX idx_export_status (export_status),
    INDEX idx_created_at (created_at),
    INDEX idx_retry (export_status, retry_count)
) COMMENT='DATEV Export Log für automatische Buchführung';

-- 4. Payment Provider Logs für Debugging
CREATE TABLE payment_provider_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NULL,
    mitglied_id INT NULL,
    provider ENUM('manual_sepa', 'stripe_datev') NOT NULL,
    action VARCHAR(100) NOT NULL COMMENT 'create_payment, export_datev, etc.',
    status ENUM('success', 'error', 'warning') NOT NULL,
    message TEXT NULL,
    data JSON NULL COMMENT 'Request/Response Daten',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE SET NULL,
    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE SET NULL,
    INDEX idx_provider_action (provider, action),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
) COMMENT='Logs für Payment Provider Debugging';

-- 5. Webhooks für Stripe Events
CREATE TABLE stripe_webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL COMMENT 'payment_intent.succeeded, etc.',
    processed BOOLEAN DEFAULT FALSE,
    payment_intent_id INT NULL,
    webhook_data JSON NOT NULL,
    processing_error TEXT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,

    FOREIGN KEY (payment_intent_id) REFERENCES stripe_payment_intents(id) ON DELETE SET NULL,
    INDEX idx_event_id (stripe_event_id),
    INDEX idx_processed (processed),
    INDEX idx_event_type (event_type)
) COMMENT='Stripe Webhook Events für Payment Processing';

-- 6. Update der bestehenden SEPA-Mandate für bessere Integration
ALTER TABLE sepa_mandate
ADD COLUMN provider ENUM('manual_sepa', 'stripe_datev') DEFAULT 'manual_sepa' COMMENT 'Welches System das Mandat verwaltet',
ADD COLUMN stripe_setup_intent_id VARCHAR(255) NULL COMMENT 'Stripe Setup Intent für SEPA',
ADD COLUMN stripe_payment_method_id VARCHAR(255) NULL COMMENT 'Stripe Payment Method ID';

-- Indices für bessere Performance
ALTER TABLE sepa_mandate
ADD INDEX idx_provider (provider),
ADD INDEX idx_stripe_payment_method (stripe_payment_method_id);

-- 7. Erstelle View für einheitlichen Payment Status
CREATE VIEW payment_status_overview AS
SELECT
    m.mitglied_id,
    m.vorname,
    m.nachname,
    d.payment_provider,
    CASE
        WHEN d.payment_provider = 'stripe_datev' THEN
            (SELECT COUNT(*) FROM stripe_payment_intents spi WHERE spi.mitglied_id = m.mitglied_id AND spi.status = 'succeeded')
        ELSE
            (SELECT COUNT(*) FROM sepa_mandate sm WHERE sm.mitglied_id = m.mitglied_id AND sm.status = 'aktiv')
    END as active_payment_methods,
    CASE
        WHEN d.payment_provider = 'stripe_datev' THEN 'Stripe + DATEV'
        ELSE 'Manuell SEPA'
    END as payment_system_name
FROM mitglieder m
JOIN dojo d ON 1=1;  -- Assuming single dojo, adjust if multiple dojos

-- Migration erfolgreich
INSERT INTO payment_provider_logs (provider, action, status, message, data)
VALUES ('manual_sepa', 'migration', 'success', 'Dual Payment System Migration completed', JSON_OBJECT('tables_created', 5, 'migration_date', NOW()));