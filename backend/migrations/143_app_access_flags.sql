-- Migration 143: Per-App Zugriffsflags für admin_users
-- Ermöglicht granulare Zugangskontrolle pro TDA-App pro Nutzer

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS events_app_access TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Zugriff auf TDA Tournament Center',
  ADD COLUMN IF NOT EXISTS kids_app_access   TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Zugriff auf Familien Sternchen',
  ADD COLUMN IF NOT EXISTS hof_app_access    TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Zugriff auf Hall of Fame';
