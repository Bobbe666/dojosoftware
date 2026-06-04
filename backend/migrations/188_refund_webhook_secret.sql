-- ============================================================================
-- Migration 188: Secret für dedizierten Refund-Webhook (pro Dojo/Stripe-Account)
-- ----------------------------------------------------------------------------
-- Der dedizierte Refund-Webhook (nur charge.refunded / refund.created/updated)
-- validiert Signaturen mit diesem Secret. Bewusst getrennt vom allgemeinen
-- Stripe-Webhook, um keine payment_intent/DATEV-Verarbeitung auszulösen.
-- ============================================================================

ALTER TABLE dojo
  ADD COLUMN IF NOT EXISTS stripe_refund_webhook_secret VARCHAR(255) NULL;
