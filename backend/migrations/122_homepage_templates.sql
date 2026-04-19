-- ============================================================
-- Migration 122: Homepage Templates & Subdomain-Konfiguration
-- ============================================================
-- Fügt Template-Auswahl und Custom-Domain-Support zur
-- dojo_homepage Tabelle hinzu
-- ============================================================

-- Template-ID: 'traditional' | 'zen' | 'combat' | 'dynamic'
ALTER TABLE dojo_homepage
  ADD COLUMN IF NOT EXISTS template_id VARCHAR(50) NOT NULL DEFAULT 'traditional' AFTER slug,
  ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) NULL DEFAULT NULL AFTER is_published,
  ADD COLUMN IF NOT EXISTS hero_image_url VARCHAR(500) NULL DEFAULT NULL AFTER custom_domain,
  ADD COLUMN IF NOT EXISTS gallery_images JSON NULL DEFAULT NULL AFTER hero_image_url;

-- Homepage feature auf Premium-Plan setzen (war Enterprise)
UPDATE plan_feature_mapping pfm
JOIN plan_features pf ON pfm.feature_id = pf.feature_id
JOIN subscription_plans sp ON pfm.plan_id = sp.plan_id
SET pfm.is_included = 1
WHERE pf.feature_key = 'homepage_builder'
  AND sp.plan_name IN ('premium', 'enterprise');

-- Sicherstellen dass feature_category korrekt ist
UPDATE plan_features
SET feature_category = 'premium'
WHERE feature_key = 'homepage_builder';

-- Alle bestehenden Dojos mit Premium oder Enterprise Plan syncen
-- (damit feature_homepage_builder = 1 gesetzt wird)
UPDATE dojo_subscriptions ds
SET feature_homepage_builder = 1
WHERE plan_type IN ('premium', 'enterprise', 'trial');
