-- =====================================================
-- Migration 078: Anredeform + Shop-Premium-Flag
-- Datum: 2026-04-14
-- Beschreibung:
--   - brief_einstellungen: anrede_form ('du'|'sie') pro Dojo konfigurierbar
--   - shop_einstellungen: feature_shop_premium Flag
-- =====================================================

-- 1. Anredeform in Brief-Einstellungen
ALTER TABLE brief_einstellungen
  ADD COLUMN IF NOT EXISTS anrede_form ENUM('du','sie') NOT NULL DEFAULT 'du'
  COMMENT 'Anredeform in Briefen und Mails: du (Standard) oder sie';

-- 2. Premium-Flag in Shop-Einstellungen
ALTER TABLE shop_einstellungen
  ADD COLUMN IF NOT EXISTS feature_shop_premium TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Premium-Features: Stripe-Zahlung, Varianten, Personalisierung';

-- TDA-Zentralshop hat Premium by default
UPDATE shop_einstellungen SET feature_shop_premium = 1 WHERE dojo_id IS NULL;
