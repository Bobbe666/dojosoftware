-- Migration 074: Teams Meeting Link für Demo-Buchungen
ALTER TABLE demo_buchungen
  ADD COLUMN teams_link VARCHAR(500) NULL AFTER admin_notiz,
  ADD COLUMN teams_meeting_id VARCHAR(255) NULL AFTER teams_link;
