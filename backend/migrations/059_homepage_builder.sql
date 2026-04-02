-- Migration 059: Homepage Builder (Enterprise Feature)
-- Fügt Homepage-Builder als Enterprise-Feature hinzu und erstellt die Homepage-Tabelle

-- 1. Feature-Flag in dojo_subscriptions hinzufügen
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='dojo_subscriptions'
     AND column_name='feature_homepage_builder') = 0,
    'ALTER TABLE dojo_subscriptions ADD COLUMN feature_homepage_builder BOOLEAN DEFAULT FALSE COMMENT ''Kostenlose Homepage für Enterprise-Kunden''',
    'SELECT ''feature_homepage_builder exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Feature-Flag in subscription_plans hinzufügen
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='subscription_plans'
     AND column_name='feature_homepage_builder') = 0,
    'ALTER TABLE subscription_plans ADD COLUMN feature_homepage_builder BOOLEAN DEFAULT FALSE',
    'SELECT ''feature_homepage_builder in plans exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Enterprise-Plan auf feature_homepage_builder=TRUE setzen
UPDATE subscription_plans SET feature_homepage_builder = TRUE WHERE plan_name = 'enterprise';

-- 4. Bestehende Enterprise-Subscriptions aktivieren
UPDATE dojo_subscriptions SET feature_homepage_builder = TRUE WHERE plan_type = 'enterprise';

-- 5. Homepage-Konfigurationstabelle erstellen
CREATE TABLE IF NOT EXISTS dojo_homepage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL UNIQUE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    config JSON NOT NULL DEFAULT ('{}'),
    is_published TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
    INDEX idx_slug (slug),
    INDEX idx_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. plan_features Eintrag für Pricing-Anzeige
INSERT IGNORE INTO plan_features
    (feature_key, feature_name, feature_icon, feature_description, feature_category, sort_order, is_active)
VALUES
    ('homepage_builder', 'Homepage Builder', '🌐',
     'Professionelle öffentliche Homepage für Ihr Dojo — inklusive im Enterprise-Paket',
     'enterprise', 100, 1);

-- 7. Addon-Preis eintragen (für spätere Nutzung, auch als Add-on buchbar)
INSERT IGNORE INTO feature_addon_prices
    (feature_id, monthly_price, yearly_price, trial_days, trial_enabled, addon_enabled,
     upgrade_hint, min_plan_for_upgrade)
SELECT
    feature_id,
    29.00,
    290.00,
    14,
    TRUE,
    TRUE,
    'Inklusive im Enterprise-Plan. Als Add-on für Professional verfügbar.',
    'enterprise'
FROM plan_features
WHERE feature_key = 'homepage_builder'
AND feature_id NOT IN (SELECT feature_id FROM feature_addon_prices);

SELECT 'Migration 059: Homepage Builder erfolgreich eingerichtet' as status;
