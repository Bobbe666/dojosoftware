-- Migration 150: trainer_app_access Flag für admin_users
-- Steuert Zugriff auf trainer.tda-intl.org — default 0 (opt-in)
-- Bestehende trainer/eingeschraenkt-Konten erhalten 1 (Bestandsschutz)
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS trainer_app_access TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Zugriff auf Trainer-App (trainer.tda-intl.org)';

UPDATE admin_users SET trainer_app_access = 1
WHERE rolle IN ('trainer', 'eingeschraenkt') AND aktiv = 1;
