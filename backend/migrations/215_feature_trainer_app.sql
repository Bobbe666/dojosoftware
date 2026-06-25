-- Coach-App (Enterprise Trainer-App): Feature-Flag pro Dojo
-- Gate für coach.tda-intl.org. Trainer brauchen ein freigeschaltetes Dojo;
-- Admins/Super-Admin haben immer Zugang.
ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS feature_trainer_app TINYINT(1) NOT NULL DEFAULT 0;

-- Pilot: Kampfkunstschule Schreiner (Dojo 3) freischalten
UPDATE dojo_subscriptions SET feature_trainer_app = 1 WHERE dojo_id = 3;
