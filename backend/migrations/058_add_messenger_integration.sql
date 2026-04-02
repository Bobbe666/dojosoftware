-- Migration 058: Facebook Messenger Integration (Enterprise Feature)
-- Adds messenger feature flag, config table, conversation mapping, and extends chat_rooms

-- 1. Feature-Flag in dojo_subscriptions
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='dojo_subscriptions'
     AND column_name='feature_messenger') = 0,
    'ALTER TABLE dojo_subscriptions ADD COLUMN feature_messenger BOOLEAN DEFAULT FALSE COMMENT ''Facebook Messenger Integration (Enterprise)''',
    'SELECT ''feature_messenger exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Enterprise-Plan auf feature_messenger=TRUE
UPDATE subscription_plans SET feature_messenger = TRUE WHERE plan_name = 'enterprise';

-- 3. chat_rooms: source + external_id
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='chat_rooms'
     AND column_name='source') = 0,
    'ALTER TABLE chat_rooms ADD COLUMN source ENUM(''internal'',''messenger'') DEFAULT ''internal''',
    'SELECT ''source exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE()
     AND table_name='chat_rooms'
     AND column_name='external_id') = 0,
    'ALTER TABLE chat_rooms ADD COLUMN external_id VARCHAR(255) NULL COMMENT ''PSID bei Messenger-Konversationen''',
    'SELECT ''external_id exists'' as info'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Messenger-Konfiguration pro Dojo
CREATE TABLE IF NOT EXISTS dojo_messenger_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL UNIQUE,
    page_id VARCHAR(100) NULL COMMENT 'Facebook Page ID',
    page_token TEXT NULL COMMENT 'Page Access Token',
    app_secret VARCHAR(255) NULL COMMENT 'App Secret für HMAC-Signaturvalidierung',
    verify_token VARCHAR(255) NULL COMMENT 'Webhook Verify Token',
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
);

-- 5. Mapping PSID → chat_room
CREATE TABLE IF NOT EXISTS messenger_conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    psid VARCHAR(255) NOT NULL COMMENT 'Page-Scoped User ID (Facebook)',
    fb_name VARCHAR(255) COMMENT 'Facebook-Anzeigename des Nutzers',
    chat_room_id INT NOT NULL,
    last_message_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dojo_psid (dojo_id, psid),
    UNIQUE KEY uq_room (chat_room_id),
    FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);

-- 6. plan_features Eintrag für Pricing-Anzeige
INSERT IGNORE INTO plan_features
    (feature_key, feature_name, feature_icon, feature_description, feature_category, sort_order, is_active)
VALUES
    ('messenger', 'Facebook Messenger', '📘',
     'Eingehende Facebook Messenger Nachrichten direkt im Chat-Dashboard beantworten',
     'communication', 90, 1);
