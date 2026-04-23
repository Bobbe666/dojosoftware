-- Migration 090: Social Media Posting Feature (Premium + Enterprise only)

ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS feature_social_media TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS feature_social_media TINYINT(1) NOT NULL DEFAULT 0;

-- Nur Enterprise erhält das Feature
UPDATE subscription_plans SET feature_social_media = 1 WHERE plan_name = 'enterprise';

-- Bestehende Dojos mit Enterprise-Plan aktivieren
UPDATE dojo_subscriptions ds
SET ds.feature_social_media = 1
WHERE ds.plan_type = 'enterprise';
