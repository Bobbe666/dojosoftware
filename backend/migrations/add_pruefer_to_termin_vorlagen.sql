-- Migration: Add pruefer field to pruefungstermin_vorlagen table
-- This allows tracking of examiners for exam schedules

ALTER TABLE pruefungstermin_vorlagen
ADD COLUMN pruefer_name VARCHAR(255) NULL COMMENT 'Name des Prüfers' AFTER pruefungsort;
