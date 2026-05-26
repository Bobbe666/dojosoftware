-- Migration 173: bezahlt_am zu beitraege hinzufügen
-- Damit kann das Dashboard echte Zahlungseingangsdaten anzeigen statt Fälligkeitsdaten

ALTER TABLE beitraege
  ADD COLUMN IF NOT EXISTS bezahlt_am DATETIME NULL DEFAULT NULL
    COMMENT 'Zeitpunkt der tatsächlichen Zahlung (NULL = noch nicht bezahlt)';

-- Backfill: bestehende bezahlte Beiträge bekommen zahlungsdatum als Näherungswert
-- (bessere Daten gibt es rückwirkend nicht)
UPDATE beitraege
SET bezahlt_am = zahlungsdatum
WHERE bezahlt = 1 AND bezahlt_am IS NULL;

CREATE INDEX IF NOT EXISTS idx_beitraege_bezahlt_am ON beitraege (bezahlt_am);
