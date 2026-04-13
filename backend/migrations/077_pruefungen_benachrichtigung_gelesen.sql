-- Migration 077: Lesebestätigung für Prüfungseinladungen
ALTER TABLE pruefungen
  ADD COLUMN IF NOT EXISTS benachrichtigung_gelesen TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benachrichtigung_gelesen_am DATETIME NULL DEFAULT NULL;
