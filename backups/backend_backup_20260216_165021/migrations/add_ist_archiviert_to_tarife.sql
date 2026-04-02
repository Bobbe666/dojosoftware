-- Migration: Spalte ist_archiviert zu tarife hinzufügen
-- Datum: 2025-01-21
-- Beschreibung: Ermöglicht das Markieren von alten Tarifen, die nicht mehr für neue Mitglieder verfügbar sein sollen

ALTER TABLE tarife
ADD COLUMN ist_archiviert BOOLEAN DEFAULT FALSE NOT NULL
COMMENT 'TRUE = Alter Tarif, nicht mehr für neue Mitglieder verfügbar';

-- Index für bessere Performance bei Filterung
CREATE INDEX idx_tarife_archiviert ON tarife(ist_archiviert);

-- Alle bestehenden Tarife bleiben aktiv (nicht archiviert)
UPDATE tarife SET ist_archiviert = FALSE WHERE ist_archiviert IS NULL;
