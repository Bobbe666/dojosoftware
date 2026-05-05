-- Migration 149: 'trainer' und 'checkin' zum admin_users.rolle ENUM hinzufügen
-- Hintergrund: Trainer-App und Check-in-App nutzen diese Rollen, waren aber nicht im ENUM definiert
ALTER TABLE admin_users
  MODIFY COLUMN rolle ENUM('super_admin','admin','mitarbeiter','eingeschraenkt','trainer','checkin')
  DEFAULT 'eingeschraenkt';
