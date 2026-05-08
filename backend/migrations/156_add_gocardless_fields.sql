-- Migration 156: GoCardless SEPA Direct Debit Fields
-- Adds GoCardless customer and mandate tracking to mitglieder table

ALTER TABLE mitglieder
  ADD COLUMN gocardless_customer_id VARCHAR(64) NULL,
  ADD COLUMN gocardless_mandate_id VARCHAR(64) NULL,
  ADD COLUMN gocardless_mandate_status VARCHAR(32) NULL DEFAULT 'none';
