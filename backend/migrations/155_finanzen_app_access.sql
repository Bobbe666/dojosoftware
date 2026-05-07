-- Migration 155: finanzen_app_access Spalte für Admin-Nutzer
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS finanzen_app_access TINYINT(1) NOT NULL DEFAULT 0;

-- Super-Admins (dojo_id IS NULL) bekommen automatisch Zugriff
UPDATE admin_users SET finanzen_app_access = 1 WHERE dojo_id IS NULL AND aktiv = 1;
