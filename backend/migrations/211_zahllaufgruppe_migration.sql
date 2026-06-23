-- Migration: mitglieder.zahllaufgruppe auf Gruppen-Key umstellen
-- Erstellt: 2026-06-23
-- Beschreibung: Spaltenbreite sicherstellen + Default auf Standard-Gruppe.
--   Bestandswerte (NULL, leer, alter Platzhalter '01') auf 'monatsanfang' mappen.
--   Andere bestehende Freitextwerte bleiben erhalten und fallen im Einzug per
--   COALESCE-Fallback in die Standard-Gruppe (kein Mitglied faellt durchs Raster).

ALTER TABLE mitglieder
    MODIFY COLUMN zahllaufgruppe VARCHAR(50) DEFAULT 'monatsanfang';

UPDATE mitglieder
   SET zahllaufgruppe = 'monatsanfang'
 WHERE zahllaufgruppe IS NULL
    OR zahllaufgruppe = ''
    OR zahllaufgruppe = '01';
