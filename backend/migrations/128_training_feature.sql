-- ============================================================
-- Migration 128: Training Timer Feature (Enterprise)
-- ============================================================

-- 1. feature_training Spalte zu dojo_subscriptions
CALL IF((SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'dojo_subscriptions'
       AND column_name = 'feature_training') = 0,
  'ALTER TABLE dojo_subscriptions ADD COLUMN feature_training BOOLEAN DEFAULT FALSE COMMENT ''Training Timer (Enterprise)''',
  'SELECT ''feature_training exists'' as info'
);

-- 2. feature_training Spalte zu subscription_plans
CALL IF((SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'subscription_plans'
       AND column_name = 'feature_training') = 0,
  'ALTER TABLE subscription_plans ADD COLUMN feature_training BOOLEAN DEFAULT FALSE',
  'SELECT ''feature_training in plans exists'' as info'
);

-- 3. Enterprise-Plan aktivieren
UPDATE subscription_plans SET feature_training = TRUE WHERE plan_name = 'enterprise';
UPDATE dojo_subscriptions  SET feature_training = TRUE WHERE plan_type  = 'enterprise';

-- 4. Tabelle für Presets (JSON pro Dojo)
CREATE TABLE IF NOT EXISTS training_presets (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id      INT NOT NULL,
  presets_json LONGTEXT NOT NULL DEFAULT '{}',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY   uk_dojo (dojo_id),
  CONSTRAINT   fk_tp_dojo FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabelle für Sync-Tokens (Trainer App Verbindung)
CREATE TABLE IF NOT EXISTS training_sync_tokens (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id        INT NOT NULL,
  sync_token     VARCHAR(64) NOT NULL,
  last_synced_at TIMESTAMP NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY     uk_dojo  (dojo_id),
  UNIQUE KEY     uk_token (sync_token),
  CONSTRAINT     fk_tst_dojo FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
