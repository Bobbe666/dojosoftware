-- =====================================================================================
-- DATENBANK-MIGRATION: Handelskalkulation-Felder hinzufügen
-- =====================================================================================
-- Fügt alle Felder für die vollständige kaufmännische Handelskalkulation hinzu
-- Datum: 2025-12-17
-- =====================================================================================

-- BEZUGSKALKULATION (Einkaufsseite)
-- =====================================================================================

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS listeneinkaufspreis_cent INT DEFAULT 0
COMMENT 'Listeneinkaufspreis in Cent';

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS lieferrabatt_prozent DECIMAL(5,2) DEFAULT 0.00
COMMENT 'Lieferrabatt in Prozent';

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS lieferskonto_prozent DECIMAL(5,2) DEFAULT 0.00
COMMENT 'Lieferskonto (Zahlungsabzug) in Prozent';

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS bezugskosten_cent INT DEFAULT 0
COMMENT 'Bezugskosten (Versand, Zoll, Verpackung) in Cent';

-- SELBSTKOSTENKALKULATION
-- =====================================================================================

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS gemeinkosten_prozent DECIMAL(5,2) DEFAULT 0.00
COMMENT 'Gemeinkosten (Miete, Personal, etc.) in Prozent';

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS gewinnzuschlag_prozent DECIMAL(5,2) DEFAULT 0.00
COMMENT 'Gewinnzuschlag in Prozent';

-- VERKAUFSKALKULATION (Verkaufsseite)
-- =====================================================================================

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS kundenskonto_prozent DECIMAL(5,2) DEFAULT 0.00
COMMENT 'Kundenskonto (Zahlungsabzug für Kunden) in Prozent';

ALTER TABLE artikel
ADD COLUMN IF NOT EXISTS kundenrabatt_prozent DECIMAL(5,2) DEFAULT 0.00
COMMENT 'Kundenrabatt in Prozent';

-- =====================================================================================
-- MIGRATION ABGESCHLOSSEN
-- =====================================================================================
