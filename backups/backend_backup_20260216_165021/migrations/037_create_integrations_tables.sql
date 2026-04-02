-- ============================================================================
-- MIGRATION 037: Integrations Tables
-- Erstellt Tabellen für: Webhooks, PayPal, LexOffice, DATEV
-- ============================================================================

-- ============================================================================
-- WEBHOOKS SYSTEM (für Zapier & externe Integrationen)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    secret VARCHAR(64) NOT NULL,
    events JSON NOT NULL COMMENT 'Array von Event-Typen',
    active TINYINT(1) DEFAULT 1,
    is_zapier TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_webhooks_dojo (dojo_id),
    INDEX idx_webhooks_active (active),
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    webhook_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
    http_status INT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_webhook_deliveries_webhook (webhook_id),
    INDEX idx_webhook_deliveries_status (status),
    INDEX idx_webhook_deliveries_created (created_at),
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PAYPAL INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS paypal_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL UNIQUE,
    mitglied_id INT,
    rechnung_id INT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_paypal_payments_mitglied (mitglied_id),
    INDEX idx_paypal_payments_status (status),
    INDEX idx_paypal_payments_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paypal_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id VARCHAR(50) NOT NULL UNIQUE,
    mitglied_id INT NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    status ENUM('pending', 'active', 'cancelled', 'expired', 'suspended') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_paypal_subscriptions_mitglied (mitglied_id),
    INDEX idx_paypal_subscriptions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Separate Integrations-Config Tabelle (dojo-Tabelle ist zu groß)
CREATE TABLE IF NOT EXISTS dojo_integrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL UNIQUE,
    -- PayPal
    paypal_client_id VARCHAR(255),
    paypal_client_secret VARCHAR(255),
    paypal_webhook_id VARCHAR(50),
    paypal_sandbox TINYINT(1) DEFAULT 1,
    -- LexOffice
    lexoffice_api_key VARCHAR(255),
    -- DATEV
    datev_consultant_number VARCHAR(20),
    datev_client_number VARCHAR(20),
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- LEXOFFICE INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS lexoffice_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL UNIQUE,
    lexoffice_contact_id VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lexoffice_mappings_mitglied (mitglied_id),
    INDEX idx_lexoffice_mappings_contact (lexoffice_contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lexoffice_invoice_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rechnungsnummer VARCHAR(50) NOT NULL UNIQUE,
    lexoffice_invoice_id VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lexoffice_invoice_rechnungsnummer (rechnungsnummer),
    INDEX idx_lexoffice_invoice_id (lexoffice_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lexoffice_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lexoffice_invoice_id VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lexoffice_payments_invoice (lexoffice_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DATEV EXPORT (Tabelle existiert möglicherweise bereits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS datev_exports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    export_type ENUM('invoices', 'payments', 'debitoren') NOT NULL,
    record_count INT DEFAULT 0,
    start_date DATE,
    end_date DATE,
    filename VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_datev_exports_dojo (dojo_id),
    INDEX idx_datev_exports_type (export_type),
    INDEX idx_datev_exports_created (created_at),
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- KALENDER / ICAL TOKENS (optional für persistente Tokens)
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    token_type ENUM('personal', 'dojo_schedule', 'dojo_events') DEFAULT 'personal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME,
    access_count INT DEFAULT 0,
    INDEX idx_calendar_tokens_mitglied (mitglied_id),
    INDEX idx_calendar_tokens_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FERTIG
-- ============================================================================

SELECT 'Migration 037: Integrations Tables erfolgreich erstellt' AS status;
