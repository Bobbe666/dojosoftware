-- =====================================================================================
-- Migration 205: WhatsApp als eigenes Enterprise-Feature (analog feature_messenger)
-- =====================================================================================
-- Fügt das Feature-Flag feature_whatsapp hinzu und verdrahtet es in der
-- Feature-Matrix (plan_features + plan_feature_mapping → Enterprise, plan_id=4).
-- Bestehende Dojos mit Messenger-Freigabe (= Enterprise) bekommen WhatsApp gleich mit.

-- 1. Spalte in dojo_subscriptions (von hasFeature + featureAccess gelesen)
ALTER TABLE dojo_subscriptions
  ADD COLUMN feature_whatsapp TINYINT(1) DEFAULT 0 AFTER feature_messenger;

-- 2. Feature in der Feature-Liste registrieren
INSERT INTO plan_features
  (feature_key, feature_name, feature_icon, feature_description, feature_category, sort_order, is_active, can_be_addon, can_be_trialed, is_public)
VALUES
  ('whatsapp', 'WhatsApp-Integration', '💬', 'Eingehende WhatsApp-Nachrichten direkt im Chat-Dashboard beantworten', 'enterprise', 331, 1, 1, 1, 1);

-- 3. Mapping: WhatsApp gehört zum Enterprise-Plan (plan_id=4)
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT 4, feature_id, 1 FROM plan_features WHERE feature_key = 'whatsapp';

-- 4. Bestehende Subscriptions: WhatsApp dort freischalten, wo Messenger frei ist (= Enterprise)
UPDATE dojo_subscriptions SET feature_whatsapp = feature_messenger;
