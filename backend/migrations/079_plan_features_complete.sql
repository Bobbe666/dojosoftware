-- =====================================================
-- Migration 079: plan_features + plan_feature_mapping
-- Datum: 2026-04-14
-- Beschreibung:
--   - Erstellt plan_features Tabelle (falls nicht vorhanden)
--   - Erstellt plan_feature_mapping Tabelle (falls nicht vorhanden)
--   - Befüllt alle Features des Systems
--   - Befüllt Zuordnung Feature → Plan (Starter / Professional / Premium / Enterprise)
--   - Aktualisiert subscription_plans display_name + description
-- =====================================================

-- ── 1. plan_features Tabelle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_features (
  feature_id      INT AUTO_INCREMENT PRIMARY KEY,
  feature_key     VARCHAR(100) NOT NULL UNIQUE,
  feature_name    VARCHAR(200) NOT NULL,
  feature_icon    VARCHAR(10) NOT NULL DEFAULT '✓',
  feature_description TEXT NULL,
  feature_category ENUM('core','financial','member','admin','premium','enterprise') NOT NULL DEFAULT 'core',
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  can_be_addon    TINYINT(1) NOT NULL DEFAULT 1,
  can_be_trialed  TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ENUM erweitern falls Tabelle schon existierte (idempotent)
ALTER TABLE plan_features
  MODIFY COLUMN feature_category
    ENUM('core','financial','member','admin','premium','enterprise')
    NOT NULL DEFAULT 'core';

-- ── 2. plan_feature_mapping Tabelle ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_feature_mapping (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  plan_id     INT NOT NULL,
  feature_id  INT NOT NULL,
  is_included TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY unique_plan_feature (plan_id, feature_id),
  FOREIGN KEY (plan_id)    REFERENCES subscription_plans(plan_id) ON DELETE CASCADE,
  FOREIGN KEY (feature_id) REFERENCES plan_features(feature_id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. subscription_plans auf aktuellen Stand bringen ────────────────────────
INSERT INTO subscription_plans
  (plan_name, display_name, description, price_monthly, price_yearly,
   max_members, max_dojos, storage_limit_mb, sort_order, is_visible, is_deprecated)
VALUES
  ('starter',      'Starter',      'Perfekt für kleine Dojos und Neugründungen',
   49.00,  490.00,  100,    1, 1000,   1, 1, 0),
  ('professional', 'Professional', 'Für etablierte Kampfsportschulen',
   89.00,  890.00,  300,    1, 5000,   2, 1, 0),
  ('premium',      'Premium',      'Alle Features für professionelle Dojos',
   149.00, 1490.00, 999999, 1, 20000,  3, 1, 0),
  ('enterprise',   'Enterprise',   'Für Dojo-Ketten und mehrere Standorte',
   249.00, 2490.00, 999999, 3, 50000,  4, 1, 0)
ON DUPLICATE KEY UPDATE
  display_name     = VALUES(display_name),
  description      = VALUES(description),
  price_monthly    = VALUES(price_monthly),
  price_yearly     = VALUES(price_yearly),
  max_members      = VALUES(max_members),
  max_dojos        = VALUES(max_dojos),
  storage_limit_mb = VALUES(storage_limit_mb),
  sort_order       = VALUES(sort_order),
  is_visible       = VALUES(is_visible),
  is_deprecated    = VALUES(is_deprecated);

-- ── 4. Features einfügen / aktualisieren ─────────────────────────────────────

-- Basis-Features (alle Pläne)
INSERT INTO plan_features (feature_key, feature_name, feature_icon, feature_category, sort_order, can_be_addon, can_be_trialed) VALUES
  ('mitgliederverwaltung', 'Mitgliederverwaltung',      '👥', 'core',         10, 0, 0),
  ('checkin',              'Check-In System',            '✅', 'core',         20, 0, 0),
  ('online_registrierung', 'Online-Registrierung',       '📋', 'core',         30, 0, 0),
  ('mitglieder_portal',    'Mitglieder-Portal (App)',    '📱', 'member',        40, 0, 0),
  ('stundenplan',          'Trainingsplan / Stundenplan','🗓️', 'core',          50, 0, 0),
  ('digitale_vertraege',   'Digitale Vertragsabschlüsse','📄', 'core',         60, 0, 0),
  ('trainerverwaltung',    'Trainerverwaltung',          '👨‍🏫', 'core',          70, 0, 0),
  ('dokumente',            'Dokumentenspeicher',         '📁', 'core',         80, 0, 0),
  ('pruefungen',           'Prüfungsverwaltung',         '🥋', 'core',         90, 1, 1),

-- Financial-Features (Professional+)
  ('sepa',                 'SEPA-Lastschriften',         '💳', 'financial',    110, 1, 1),
  ('rechnungen',           'Rechnungen & Mahnwesen',     '📑', 'financial',    120, 1, 1),
  ('verkauf',              'Verkauf & Kassensystem',     '🛒', 'financial',    130, 1, 1),
  ('beitragsabrechnung',   'Automatische Beitragsabrechnung','⚙️', 'financial', 140, 1, 1),

-- Events (Professional+)
  ('events',               'Eventsverwaltung',           '🎉', 'core',        150, 1, 1),

-- Premium-Features
  ('finanzcockpit',        'Finanzcockpit & EÜR',        '📊', 'financial',   210, 1, 1),
  ('homepage_builder',     'Homepage-Builder',           '🌐', 'premium',     220, 1, 1),
  ('api',                  'API-Zugang',                 '🔗', 'premium',     230, 1, 1),
  ('chat',                 'Interner Chat',              '💬', 'premium',     240, 1, 1),
  ('shop',                 'Online-Shop',                '🏪', 'premium',     250, 1, 1),

-- Enterprise-Features
  ('multidojo',            'Multi-Dojo Management',      '🏢', 'enterprise',  310, 0, 0),
  ('bank_import',          'Bank-Import / Kontoauszüge', '🏦', 'enterprise',  320, 0, 0),
  ('messenger',            'Messenger-Integration',      '📩', 'enterprise',  330, 0, 0),
  ('priority_support',     'Priority Support & SLA',     '⭐', 'enterprise',  340, 0, 0)

ON DUPLICATE KEY UPDATE
  feature_name    = VALUES(feature_name),
  feature_icon    = VALUES(feature_icon),
  feature_category= VALUES(feature_category),
  sort_order      = VALUES(sort_order);

-- ── 5. Plan-Feature-Mappings ──────────────────────────────────────────────────
-- Hilfsprozedur: alle alten Mappings löschen und neu setzen
DELETE FROM plan_feature_mapping;

-- STARTER (plan_name = 'starter')
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'starter'
  AND f.feature_key IN (
    'mitgliederverwaltung',
    'checkin',
    'online_registrierung',
    'mitglieder_portal',
    'stundenplan',
    'digitale_vertraege',
    'trainerverwaltung',
    'dokumente',
    'pruefungen'
  );

-- PROFESSIONAL (alle Starter-Features + mehr)
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'professional'
  AND f.feature_key IN (
    'mitgliederverwaltung',
    'checkin',
    'online_registrierung',
    'mitglieder_portal',
    'stundenplan',
    'digitale_vertraege',
    'trainerverwaltung',
    'dokumente',
    'pruefungen',
    'sepa',
    'rechnungen',
    'verkauf',
    'beitragsabrechnung',
    'events'
  );

-- PREMIUM (alle Professional-Features + mehr)
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'premium'
  AND f.feature_key IN (
    'mitgliederverwaltung',
    'checkin',
    'online_registrierung',
    'mitglieder_portal',
    'stundenplan',
    'digitale_vertraege',
    'trainerverwaltung',
    'dokumente',
    'pruefungen',
    'sepa',
    'rechnungen',
    'verkauf',
    'beitragsabrechnung',
    'events',
    'finanzcockpit',
    'homepage_builder',
    'api',
    'chat',
    'shop'
  );

-- ENTERPRISE (alle Features)
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'enterprise';

SELECT 'Migration 079: plan_features + Mappings erfolgreich' as status;
