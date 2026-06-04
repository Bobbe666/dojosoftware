-- ============================================================================
-- Migration 188: Secret für dedizierten Refund-Webhook (pro Dojo/Stripe-Account)
-- ----------------------------------------------------------------------------
-- Eigene Tabelle (dojo-Tabelle ist zu breit für eine weitere Spalte / Row-Size).
-- Der dedizierte Refund-Webhook validiert Signaturen mit diesem Secret.
-- ============================================================================

CREATE TABLE IF NOT EXISTS stripe_refund_webhooks (
  dojo_id              INT PRIMARY KEY,
  webhook_endpoint_id  VARCHAR(255) NULL,
  secret               VARCHAR(255) NOT NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
