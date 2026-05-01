-- Migration 142: todo_app_access column for admin_users
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS todo_app_access TINYINT(1) NOT NULL DEFAULT 1;
