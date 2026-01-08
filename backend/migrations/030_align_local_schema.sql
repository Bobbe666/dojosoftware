-- ===================================================================
-- Schema-Anpassung: Lokale DB an Produktions-Schema angleichen
-- ===================================================================

-- 1. mitglieder: beigetreten_am Spalte hinzufügen
-- Ignoriere Fehler falls Spalte bereits existiert
ALTER TABLE mitglieder
  ADD COLUMN beigetreten_am DATE NULL AFTER eintrittsdatum;

-- 2. rechnungen: gesamtsumme Spalte hinzufügen
-- Ignoriere Fehler falls Spalte bereits existiert
ALTER TABLE rechnungen
  ADD COLUMN gesamtsumme DECIMAL(10,2) NULL AFTER betrag;

-- ===================================================================
-- ✅ Migration abgeschlossen
-- ===================================================================
