-- Migration: Add dojo_id to kassenbuch table
-- Date: 2025-01-08
-- Description: Fügt dojo_id Spalte zu kassenbuch hinzu für Multi-Dojo-Support

-- Füge dojo_id Spalte hinzu
ALTER TABLE kassenbuch
ADD COLUMN dojo_id INT NULL AFTER eintrag_id,
ADD INDEX idx_dojo_id (dojo_id);

-- Setze dojo_id für existierende Einträge (falls verkauf_id vorhanden)
UPDATE kassenbuch kb
LEFT JOIN verkaeufe v ON kb.verkauf_id = v.verkauf_id
LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
SET kb.dojo_id = m.dojo_id
WHERE kb.verkauf_id IS NOT NULL AND m.dojo_id IS NOT NULL;

-- Für Einträge ohne verkauf_id: Setze auf dojo_id 1 (Standard)
UPDATE kassenbuch
SET dojo_id = 1
WHERE dojo_id IS NULL;

-- Kommentar hinzufügen
ALTER TABLE kassenbuch
MODIFY COLUMN dojo_id INT NULL COMMENT 'Dojo-Zugehörigkeit für Multi-Dojo-Support';
