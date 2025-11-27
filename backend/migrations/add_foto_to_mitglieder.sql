-- =====================================================================================
-- MIGRATION: Foto-Upload für Mitglieder hinzufügen
-- =====================================================================================
-- Fügt eine foto_pfad Spalte zur mitglieder-Tabelle hinzu
-- =====================================================================================

-- Füge die Spalte hinzu
ALTER TABLE mitglieder ADD COLUMN foto_pfad VARCHAR(500) NULL COMMENT 'Pfad zum Mitgliedsfoto';

-- Erstelle Index für bessere Performance
CREATE INDEX idx_mitglieder_foto ON mitglieder(foto_pfad);

SELECT 'Migration: Foto-Upload für Mitglieder erfolgreich hinzugefügt' AS Status;
