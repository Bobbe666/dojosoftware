-- Migration 134: Trainer-Zugänge (Passwort-Verwaltung)
CREATE TABLE IF NOT EXISTS trainer_zugaenge (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  trainer_id  INT NOT NULL,
  dojo_id     INT,
  app_type    ENUM('checkin','dojo','trainer') NOT NULL,
  email       VARCHAR(255),
  username    VARCHAR(100),
  passwort    VARCHAR(255),
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_trainer_app (trainer_id, app_type),
  INDEX idx_trainer (trainer_id),
  INDEX idx_dojo (dojo_id)
);
