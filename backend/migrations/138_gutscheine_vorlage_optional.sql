-- Migration 138: vorlage_id in gutscheine nullable machen
-- Intern erstellte Gutscheine brauchen kein Design-Template

ALTER TABLE gutscheine
  MODIFY COLUMN vorlage_id INT NULL;
