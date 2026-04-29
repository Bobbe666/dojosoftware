-- Verknüpft admin_users mit einem Trainer-Profil für bidirektionale Synchronisation
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS trainer_id INT NULL DEFAULT NULL;

-- Index für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_trainer_id ON admin_users(trainer_id);
