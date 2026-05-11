-- Buchungskategorie pro Rechnungsposition + globaler Default auf der Rechnung selbst
ALTER TABLE rechnungspositionen
  ADD COLUMN IF NOT EXISTS buchungskategorie VARCHAR(100) NULL COMMENT 'EÜR-Kategorie für diese Position';

ALTER TABLE rechnungen
  ADD COLUMN IF NOT EXISTS buchungskategorie_default VARCHAR(100) NULL COMMENT 'Globale EÜR-Kategorie (Fallback für alle Positionen ohne eigene Kategorie)';
