-- =============================================================================
-- Migration 238: shop_einstellungen.feature_shop_premium nachlegen (Prod-Fix)
-- Migration 078 wollte diese Spalte anlegen, nutzte aber `ADD COLUMN IF NOT EXISTS`
-- — von der Prod-MariaDB-Version NICHT unterstützt → wurde ignoriert, Spalte fehlte.
-- Folge: öffentlicher Shop (/api/shop/public/:dojo/einstellungen) → 500
-- ("Unknown column 'feature_shop_premium'"), shop.js nutzt die Spalte fürs
-- Premium-Gating (z.B. Stripe-Zahlung nur für Premium-Shops).
-- Diese Migration ist idempotent (information_schema-Check statt IF NOT EXISTS).
-- Auf Prod bereits direkt angewandt 2026-07-20.
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'shop_einstellungen'
     AND COLUMN_NAME = 'feature_shop_premium'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE shop_einstellungen ADD COLUMN feature_shop_premium TINYINT(1) NOT NULL DEFAULT 0',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Zentraler TDA-Shop (dojo_id IS NULL) ist Premium
UPDATE shop_einstellungen SET feature_shop_premium = 1 WHERE dojo_id IS NULL;
