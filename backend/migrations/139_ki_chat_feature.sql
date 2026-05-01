-- Migration 139: KI-Chat Widget als Enterprise Feature

ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS feature_ki_chat TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Enterprise: KI-Chat-Widget für eigene Homepage';

CREATE TABLE IF NOT EXISTS visitor_chat_config (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id         INT NOT NULL UNIQUE,
  assistent_name  VARCHAR(100) NOT NULL DEFAULT 'Assistent',
  begruessung     TEXT NULL COMMENT 'Begrüßungstext des Widgets',
  akzentfarbe     VARCHAR(7)  NOT NULL DEFAULT '#ef4444',
  ki_aktiv        TINYINT(1)  NOT NULL DEFAULT 1,
  zusatz_kontext  TEXT NULL   COMMENT 'Wird dem AI-Systemprompt hinzugefügt',
  erstellt_am     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  geaendert_am    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
