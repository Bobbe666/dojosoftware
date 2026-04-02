-- =====================================================================================
-- PREISKALKULATION FELDER FÜR ARTIKEL
-- =====================================================================================
-- Erweitert die Artikel-Tabelle um Felder für vollständige Preiskalkulation:
-- - Zusatzkosten (Versand, Verpackung, etc.)
-- - Marge in Prozent (Gewinnaufschlag)
-- =====================================================================================

-- Zusatzkosten-Feld hinzufügen (in Cent, wie die anderen Preisfelder)
ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS zusatzkosten_cent INT DEFAULT 0
AFTER einkaufspreis_cent
COMMENT 'Zusätzliche Kosten (Versand, Verpackung, etc.) in Cent';

-- Marge-Prozent-Feld hinzufügen
ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS marge_prozent DECIMAL(5,2) DEFAULT NULL
AFTER zusatzkosten_cent
COMMENT 'Gewinnaufschlag in Prozent';

-- Index für Performance (optional)
CREATE INDEX IF NOT EXISTS idx_artikel_preiskalkulation
ON artikel (einkaufspreis_cent, zusatzkosten_cent, verkaufspreis_cent);

-- Erfolgsmeldung
SELECT 'Preiskalkulations-Felder erfolgreich hinzugefügt!' as Status;
