-- Migration: Lastschrift-Typ von ENUM zu VARCHAR
-- Erstellt: 2026-02-10
-- Beschreibung: Erlaubt mehrere Typen als komma-getrennte Liste (z.B. "beitraege,rechnungen")

-- Ändere typ-Spalte von ENUM zu VARCHAR
ALTER TABLE lastschrift_zeitplaene
MODIFY COLUMN typ VARCHAR(100) NOT NULL DEFAULT 'beitraege';
