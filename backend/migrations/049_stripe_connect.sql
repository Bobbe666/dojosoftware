-- Migration: Stripe Connect Integration
-- Erstellt: 2026-02-04

-- Tabelle für Stripe Connect Accounts
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT UNIQUE NOT NULL,
    stripe_account_id VARCHAR(255) UNIQUE,  -- acct_xxxxx
    access_token TEXT,                       -- OAuth Token (verschlüsselt)
    refresh_token TEXT,
    connection_status ENUM('pending', 'connected', 'disconnected') DEFAULT 'pending',
    charges_enabled BOOLEAN DEFAULT FALSE,
    payouts_enabled BOOLEAN DEFAULT FALSE,
    business_type VARCHAR(50),               -- individual, company, non_profit
    country VARCHAR(2) DEFAULT 'DE',
    default_currency VARCHAR(3) DEFAULT 'EUR',
    platform_fee_percent DECIMAL(5,2) DEFAULT 0.00,  -- Konfigurierbare Platform-Gebühr
    platform_fee_fixed_cents INT DEFAULT 0,
    connected_at TIMESTAMP NULL,
    disconnected_at TIMESTAMP NULL,
    last_webhook_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
    INDEX idx_stripe_account (stripe_account_id),
    INDEX idx_connection_status (connection_status)
);

-- OAuth State für sicheren OAuth-Flow
CREATE TABLE IF NOT EXISTS stripe_connect_oauth_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    state VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
    INDEX idx_state (state),
    INDEX idx_expires (expires_at)
);

-- Payment Provider Enum erweitern
ALTER TABLE dojo
MODIFY COLUMN payment_provider ENUM('manual_sepa', 'stripe_datev', 'stripe_connect') DEFAULT 'manual_sepa';

-- Transfers/Auszahlungen tracken
CREATE TABLE IF NOT EXISTS stripe_connect_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    stripe_account_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    amount_total INT NOT NULL,              -- Gesamtbetrag in Cents
    amount_fee INT DEFAULT 0,               -- Platform-Gebühr in Cents
    amount_net INT NOT NULL,                -- Nettobetrag für Dojo in Cents
    currency VARCHAR(3) DEFAULT 'EUR',
    status ENUM('pending', 'paid', 'failed', 'canceled') DEFAULT 'pending',
    description TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id),
    INDEX idx_transfer_dojo (dojo_id),
    INDEX idx_transfer_status (status),
    INDEX idx_transfer_stripe (stripe_transfer_id)
);
