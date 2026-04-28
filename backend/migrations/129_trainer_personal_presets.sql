-- Migration 129: Trainer Personal Presets
-- Persönliche Training-Presets pro Admin-User (Trainer)
-- Jeder Trainer kann eigene Presets haben, unabhängig von den Dojo-Presets

CREATE TABLE IF NOT EXISTS trainer_personal_presets (
  id           INT NOT NULL AUTO_INCREMENT,
  admin_user_id INT NOT NULL,
  dojo_id      INT NOT NULL,
  presets_json LONGTEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_user (admin_user_id),
  CONSTRAINT fk_tpp_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
