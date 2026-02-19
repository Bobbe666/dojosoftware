-- Migration 045: Feature Trials und Addons System
-- Ermöglicht kostenlose 14-Tage Feature-Trials und kostenpflichtige Feature-Addons

-- 1. Feature Trials Tabelle
-- Speichert aktive und abgelaufene Feature-Trials pro Dojo
CREATE TABLE IF NOT EXISTS feature_trials (
    trial_id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    feature_id INT NOT NULL,

    -- Trial Zeitraum
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,

    -- Status
    status ENUM('active', 'expired', 'converted', 'cancelled') DEFAULT 'active',
    converted_to_addon_id INT NULL COMMENT 'Falls in Addon konvertiert',
    converted_to_plan VARCHAR(50) NULL COMMENT 'Falls Plan upgraded',

    -- Tracking
    started_by_admin_id INT NULL COMMENT 'Falls von Admin gestartet',
    cancelled_at DATETIME NULL,
    cancel_reason TEXT NULL,

    -- Notifications
    reminder_7d_sent BOOLEAN DEFAULT FALSE,
    reminder_3d_sent BOOLEAN DEFAULT FALSE,
    reminder_1d_sent BOOLEAN DEFAULT FALSE,
    expiry_notification_sent BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE KEY unique_dojo_feature_trial (dojo_id, feature_id, status),
    INDEX idx_dojo (dojo_id),
    INDEX idx_feature (feature_id),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at),

    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES plan_features(feature_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Feature Addons Tabelle
-- Speichert kostenpflichtige Feature-Erweiterungen
CREATE TABLE IF NOT EXISTS feature_addons (
    addon_id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    feature_id INT NOT NULL,

    -- Preis & Abrechnung
    monthly_price DECIMAL(10,2) NOT NULL,
    billing_interval ENUM('monthly', 'yearly') DEFAULT 'monthly',

    -- Zeitraum
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL COMMENT 'NULL = unbegrenzt (bis Kündigung)',
    cancelled_at DATETIME NULL,

    -- Status
    status ENUM('active', 'cancelled', 'expired', 'suspended') DEFAULT 'active',

    -- Stripe Integration
    stripe_subscription_id VARCHAR(255) NULL,
    stripe_price_id VARCHAR(255) NULL,

    -- Conversion Tracking
    converted_from_trial_id INT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE KEY unique_active_addon (dojo_id, feature_id, status),
    INDEX idx_dojo (dojo_id),
    INDEX idx_feature (feature_id),
    INDEX idx_status (status),
    INDEX idx_stripe (stripe_subscription_id),

    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES plan_features(feature_id) ON DELETE CASCADE,
    FOREIGN KEY (converted_from_trial_id) REFERENCES feature_trials(trial_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Feature Addon Preise Tabelle
-- Standard-Preise pro Feature für Addon-Verkauf
CREATE TABLE IF NOT EXISTS feature_addon_prices (
    price_id INT PRIMARY KEY AUTO_INCREMENT,
    feature_id INT NOT NULL UNIQUE,

    -- Preise
    monthly_price DECIMAL(10,2) NOT NULL DEFAULT 9.00,
    yearly_price DECIMAL(10,2) NOT NULL DEFAULT 90.00,

    -- Trial-Einstellungen
    trial_days INT DEFAULT 14 COMMENT 'Kostenlose Trial-Tage',
    trial_enabled BOOLEAN DEFAULT TRUE,

    -- Addon-Einstellungen
    addon_enabled BOOLEAN DEFAULT TRUE COMMENT 'Kann als Addon gekauft werden',

    -- Stripe
    stripe_monthly_price_id VARCHAR(255) NULL,
    stripe_yearly_price_id VARCHAR(255) NULL,

    -- Hinweis für Upgrade
    upgrade_hint TEXT NULL COMMENT 'z.B. "Verfügbar ab Professional"',
    min_plan_for_upgrade VARCHAR(50) NULL COMMENT 'Niedrigster Plan der Feature enthält',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (feature_id) REFERENCES plan_features(feature_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Füge Standard-Preise für alle Features ein
INSERT INTO feature_addon_prices (feature_id, monthly_price, yearly_price, trial_days, trial_enabled, addon_enabled)
SELECT
    feature_id,
    9.00 as monthly_price,
    90.00 as yearly_price,
    14 as trial_days,
    TRUE as trial_enabled,
    TRUE as addon_enabled
FROM plan_features
WHERE feature_id NOT IN (SELECT feature_id FROM feature_addon_prices)
ON DUPLICATE KEY UPDATE price_id = price_id;

-- 5. Feature Access Log (für Analytics)
CREATE TABLE IF NOT EXISTS feature_access_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    feature_id INT NOT NULL,

    access_type ENUM('plan', 'trial', 'addon') NOT NULL,
    access_granted BOOLEAN NOT NULL,

    -- Details
    current_plan VARCHAR(50) NULL,
    trial_id INT NULL,
    addon_id INT NULL,

    -- Context
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,

    INDEX idx_dojo (dojo_id),
    INDEX idx_feature (feature_id),
    INDEX idx_accessed (accessed_at),

    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES plan_features(feature_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Update plan_features mit Addon-Info Spalten (falls nicht vorhanden)
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='plan_features'
     AND column_name='can_be_addon') = 0,
    'ALTER TABLE plan_features ADD COLUMN can_be_addon BOOLEAN DEFAULT TRUE',
    'SELECT ''can_be_addon exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='plan_features'
     AND column_name='can_be_trialed') = 0,
    'ALTER TABLE plan_features ADD COLUMN can_be_trialed BOOLEAN DEFAULT TRUE',
    'SELECT ''can_be_trialed exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fertig!
SELECT 'Migration 045: Feature Trials & Addons erfolgreich erstellt' as status;
