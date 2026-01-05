-- Migration 029: Multi-Tenant Subscription System (LOKALE VERSION)
-- Angepasst für lokale `dojo` Tabelle (singular, PK=id)
-- Fügt Subscription-Verwaltung und Feature-Toggles hinzu

-- 1. Erweitere dojo Tabelle (Spalten einzeln hinzufügen)
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='dojo'
     AND column_name='subdomain') = 0,
    'ALTER TABLE dojo ADD COLUMN subdomain VARCHAR(100) UNIQUE AFTER dojoname',
    'SELECT ''subdomain exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='dojo'
     AND column_name='onboarding_completed') = 0,
    'ALTER TABLE dojo ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE',
    'SELECT ''onboarding_completed exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='dojo'
     AND column_name='registration_date') = 0,
    'ALTER TABLE dojo ADD COLUMN registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    'SELECT ''registration_date exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Erstelle dojo_subscriptions Tabelle
CREATE TABLE IF NOT EXISTS dojo_subscriptions (
    subscription_id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL UNIQUE,
    subdomain VARCHAR(100) UNIQUE NOT NULL,

    -- Abo-Plan & Status
    plan_type ENUM('trial', 'starter', 'professional', 'premium', 'enterprise') DEFAULT 'trial',
    status ENUM('active', 'trial', 'suspended', 'cancelled', 'expired') DEFAULT 'trial',

    -- Feature-Toggles
    feature_verkauf BOOLEAN DEFAULT FALSE COMMENT 'Verkauf & Lagerhaltung',
    feature_buchfuehrung BOOLEAN DEFAULT FALSE COMMENT 'Rechnungen, Mahnwesen, Finanzcockpit',
    feature_events BOOLEAN DEFAULT FALSE COMMENT 'Event-Verwaltung',
    feature_multidojo BOOLEAN DEFAULT FALSE COMMENT 'Mehrere Standorte verwalten',
    feature_api BOOLEAN DEFAULT FALSE COMMENT 'API-Zugang',

    -- Limits
    max_members INT DEFAULT 50 COMMENT 'Maximale Anzahl aktiver Mitglieder',
    max_dojos INT DEFAULT 1 COMMENT 'Anzahl verwaltbarer Dojos',
    storage_limit_mb INT DEFAULT 1000 COMMENT 'Speicherplatz für Dokumente in MB',
    current_storage_mb INT DEFAULT 0 COMMENT 'Aktuell genutzter Speicher',

    -- Zeiträume
    trial_ends_at DATETIME NULL COMMENT 'Ende der Trial-Phase',
    subscription_starts_at DATETIME NULL COMMENT 'Start des bezahlten Abos',
    subscription_ends_at DATETIME NULL COMMENT 'Ende des aktuellen Abo-Zeitraums',
    cancelled_at DATETIME NULL COMMENT 'Kündigungsdatum',

    -- Billing
    monthly_price DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Monatlicher Preis in EUR',
    billing_interval ENUM('monthly', 'yearly') DEFAULT 'monthly',
    billing_email VARCHAR(255) NULL COMMENT 'Rechnungs-Email',
    payment_method ENUM('sepa', 'invoice', 'creditcard') NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indizes
    INDEX idx_subdomain (subdomain),
    INDEX idx_plan_type (plan_type),
    INDEX idx_status (status),

    -- Foreign Key zu dojo.id (nicht dojos.dojo_id!)
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Prüfe ob admins Tabelle existiert (singular oder plural)
SET @admins_table = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
     WHERE table_schema=DATABASE() AND table_name='admins') > 0,
    'admins',
    (SELECT IF(
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
         WHERE table_schema=DATABASE() AND table_name='admin_users') > 0,
        'admin_users',
        'none'
    ))
));

-- Erweitere admins oder admin_users Tabelle mit dojo_id falls nicht vorhanden
SET @s = (SELECT IF(
    @admins_table != 'none' AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name=@admins_table
     AND column_name='dojo_id') = 0,
    CONCAT('ALTER TABLE ', @admins_table, ' ADD COLUMN dojo_id INT NULL AFTER id'),
    'SELECT ''dojo_id in admins exists or no admin table'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Erstelle initiale Subscription für bestehendes Dojo (falls vorhanden)
INSERT INTO dojo_subscriptions
    (dojo_id, subdomain, plan_type, status, feature_verkauf, feature_buchfuehrung,
     feature_events, feature_multidojo, feature_api, max_members, trial_ends_at)
SELECT
    id as dojo_id,
    COALESCE(subdomain, CONCAT('dojo-', id)) as subdomain,
    'premium' as plan_type,
    'active' as status,
    TRUE as feature_verkauf,
    TRUE as feature_buchfuehrung,
    TRUE as feature_events,
    FALSE as feature_multidojo,
    FALSE as feature_api,
    999999 as max_members,
    NULL as trial_ends_at
FROM dojo
WHERE id NOT IN (SELECT dojo_id FROM dojo_subscriptions)
ON DUPLICATE KEY UPDATE subscription_id = subscription_id;

-- 5. Update subdomain für bestehendes Dojo falls leer
UPDATE dojo
SET subdomain = CONCAT('dojo-', id)
WHERE subdomain IS NULL OR subdomain = '';

-- 6. Erstelle Plan-Templates Tabelle
CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id INT PRIMARY KEY AUTO_INCREMENT,
    plan_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Preise
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,

    -- Features
    feature_verkauf BOOLEAN DEFAULT FALSE,
    feature_buchfuehrung BOOLEAN DEFAULT FALSE,
    feature_events BOOLEAN DEFAULT FALSE,
    feature_multidojo BOOLEAN DEFAULT FALSE,
    feature_api BOOLEAN DEFAULT FALSE,

    -- Limits
    max_members INT NOT NULL,
    max_dojos INT DEFAULT 1,
    storage_limit_mb INT DEFAULT 1000,

    -- Sortierung & Sichtbarkeit
    sort_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    is_deprecated BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Füge Standard-Pläne ein (falls noch nicht vorhanden)
INSERT INTO subscription_plans
    (plan_name, display_name, description, price_monthly, price_yearly,
     feature_verkauf, feature_buchfuehrung, feature_events, feature_multidojo, feature_api,
     max_members, max_dojos, storage_limit_mb, sort_order)
VALUES
    ('starter', 'Starter', 'Perfekt für kleine Dojos und Neugründungen',
     49.00, 490.00, FALSE, FALSE, FALSE, FALSE, FALSE, 100, 1, 1000, 1),

    ('professional', 'Professional', 'Für etablierte Kampfsportschulen',
     89.00, 890.00, TRUE, FALSE, TRUE, FALSE, FALSE, 300, 1, 5000, 2),

    ('premium', 'Premium', 'Alle Features für professionelle Dojos',
     149.00, 1490.00, TRUE, TRUE, TRUE, FALSE, TRUE, 999999, 1, 20000, 3),

    ('enterprise', 'Enterprise', 'Für Dojo-Ketten und mehrere Standorte',
     249.00, 2490.00, TRUE, TRUE, TRUE, TRUE, TRUE, 999999, 3, 50000, 4)
ON DUPLICATE KEY UPDATE plan_id = plan_id;

-- 8. Erstelle Audit-Log für Subscription-Änderungen
CREATE TABLE IF NOT EXISTS subscription_audit_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    subscription_id INT NOT NULL,
    dojo_id INT NOT NULL,

    action ENUM('created', 'upgraded', 'downgraded', 'cancelled', 'reactivated', 'suspended', 'feature_enabled', 'feature_disabled') NOT NULL,
    old_plan VARCHAR(50),
    new_plan VARCHAR(50),
    changed_by_admin_id INT NULL,
    reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_subscription (subscription_id),
    INDEX idx_dojo (dojo_id),
    INDEX idx_action (action),

    FOREIGN KEY (subscription_id) REFERENCES dojo_subscriptions(subscription_id) ON DELETE CASCADE,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fertig!
SELECT 'Migration 029 (LOKAL) erfolgreich ausgeführt' as status;
