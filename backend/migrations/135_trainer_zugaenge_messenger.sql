-- Migration 135: Messenger zu trainer_zugaenge app_type hinzufügen
ALTER TABLE trainer_zugaenge
  MODIFY COLUMN app_type ENUM('checkin','dojo','trainer','messenger') NOT NULL;
