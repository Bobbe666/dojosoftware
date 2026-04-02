-- =====================================================================
-- Migration 071: Shop — Artikel-Integration
-- Verbindet den Shop mit der bestehenden Artikel-Verwaltung
-- =====================================================================

-- 1. shop_aktiv-Flag zu artikel hinzufügen
ALTER TABLE artikel
  ADD COLUMN IF NOT EXISTS shop_aktiv TINYINT(1) DEFAULT 0 AFTER aktiv;

ALTER TABLE artikel
  ADD INDEX IF NOT EXISTS idx_shop_aktiv (shop_aktiv);

-- 2. artikel_id zu shop_bestellpositionen hinzufügen
ALTER TABLE shop_bestellpositionen
  ADD COLUMN IF NOT EXISTS artikel_id INT NULL DEFAULT NULL AFTER produkt_id,
  ADD INDEX IF NOT EXISTS idx_artikel_id (artikel_id);

-- 3. Alte Test-Daten aus shop_produkte entfernen
DELETE FROM shop_produkte WHERE 1=1;

-- 4. Alte Test-Kategorien aus shop_kategorien entfernen
DELETE FROM shop_kategorien WHERE 1=1;
