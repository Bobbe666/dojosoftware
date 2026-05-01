-- ============================================================
-- Migration 141: To-Do System (Enterprise)
-- ============================================================

-- 1. todos Tabelle
CREATE TABLE IF NOT EXISTS todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NULL,
  kontext ENUM('allgemein','lizenzen','verband','hof','events') NOT NULL DEFAULT 'allgemein',
  titel VARCHAR(255) NOT NULL,
  beschreibung TEXT NULL,
  prioritaet ENUM('niedrig','normal','hoch','dringend') NOT NULL DEFAULT 'normal',
  status ENUM('offen','in_bearbeitung','erledigt') NOT NULL DEFAULT 'offen',
  faellig_am DATE NULL,
  erstellt_von INT NULL,
  zugewiesen_an VARCHAR(100) NULL,
  erstellt_am TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_status (status),
  INDEX idx_kontext (kontext),
  FOREIGN KEY (erstellt_von) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. feature_todos Spalte in dojo_subscriptions
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'dojo_subscriptions' AND column_name = 'feature_todos') = 0,
  'ALTER TABLE dojo_subscriptions ADD COLUMN feature_todos BOOLEAN DEFAULT FALSE COMMENT ''To-Do System (Enterprise)''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. feature_todos Spalte in subscription_plans
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'subscription_plans' AND column_name = 'feature_todos') = 0,
  'ALTER TABLE subscription_plans ADD COLUMN feature_todos BOOLEAN DEFAULT FALSE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Enterprise aktivieren
UPDATE subscription_plans SET feature_todos = TRUE WHERE plan_name = 'enterprise';
UPDATE dojo_subscriptions  SET feature_todos = TRUE WHERE plan_type  = 'enterprise';
