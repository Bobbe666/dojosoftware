-- Migration 060: Add Stripe SaaS Fields
-- Fügt Stripe Price IDs für SaaS Subscriptions hinzu

-- 1. Stripe Price IDs für subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_monthly VARCHAR(100) NULL COMMENT 'Stripe Price ID für monatliche Zahlung',
  ADD COLUMN IF NOT EXISTS stripe_price_yearly VARCHAR(100) NULL COMMENT 'Stripe Price ID für jährliche Zahlung';

-- 2. Stripe Customer und Subscription IDs für dojo_subscriptions
ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100) NULL COMMENT 'Stripe Customer ID',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100) NULL COMMENT 'Stripe Subscription ID';

-- 3. Index für Stripe IDs
CREATE INDEX IF NOT EXISTS idx_stripe_customer ON dojo_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscription ON dojo_subscriptions(stripe_subscription_id);

-- 4. Tabelle für Stripe Payment Events (Webhook-Logs)
CREATE TABLE IF NOT EXISTS saas_payment_events (
    event_id INT PRIMARY KEY AUTO_INCREMENT,
    stripe_event_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    dojo_id INT NULL,
    stripe_customer_id VARCHAR(100) NULL,
    stripe_subscription_id VARCHAR(100) NULL,
    amount_cents INT NULL,
    currency VARCHAR(10) DEFAULT 'eur',
    status VARCHAR(50) NULL,
    raw_data JSON NULL,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_event_type (event_type),
    INDEX idx_dojo (dojo_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Erweitere audit_log actions
ALTER TABLE subscription_audit_log
  MODIFY COLUMN action ENUM(
    'created', 'upgraded', 'downgraded', 'cancelled', 'reactivated',
    'suspended', 'feature_enabled', 'feature_disabled',
    'admin_activated', 'dojo_deactivated', 'dojo_reactivated',
    'payment_succeeded', 'payment_failed', 'stripe_checkout_started'
  ) NOT NULL;

SELECT 'Migration 060 erfolgreich' as status;
