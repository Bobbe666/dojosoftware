-- Migration 038: Vertragsmodell-Auswahl fuer Dojos
-- Ermoeglicht Wahl zwischen gesetzlicher Verlaengerung und Beitragsgarantie-Modell

-- =====================================================
-- DOJO-TABELLE: Vertragsmodell-Einstellungen
-- =====================================================

-- Vertragsmodell-Typ
-- 'gesetzlich' = Automatische Verlaengerung nach deutschem Recht (Standard)
-- 'beitragsgarantie' = Aktive Verlaengerung erforderlich fuer Preisschutz
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vertragsmodell ENUM('gesetzlich', 'beitragsgarantie') DEFAULT 'gesetzlich'
    COMMENT 'Vertragsmodell: gesetzlich = Auto-Verlaengerung, beitragsgarantie = Aktive Verlaengerung fuer Preisschutz';

-- Bei Beitragsgarantie-Modell: Was passiert wenn nicht verlaengert wird?
-- 'aktueller_tarif' = Mitglied zahlt automatisch den aktuellen Tarifpreis
-- 'vertrag_endet' = Vertrag endet wenn nicht aktiv verlaengert
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS beitragsgarantie_bei_nichtverlaengerung ENUM('aktueller_tarif', 'vertrag_endet') DEFAULT 'aktueller_tarif'
    COMMENT 'Was passiert bei Nicht-Verlaengerung: aktueller_tarif oder vertrag_endet';

-- Erinnerung X Tage vor Vertragsende senden
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS verlaengerung_erinnerung_tage INT DEFAULT 60
    COMMENT 'Tage vor Vertragsende fuer Erinnerungs-E-Mail';

-- Zweite Erinnerung (optional)
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS verlaengerung_erinnerung2_tage INT DEFAULT 30
    COMMENT 'Tage vor Vertragsende fuer zweite Erinnerungs-E-Mail (0 = deaktiviert)';

-- Letzte Erinnerung (dringend)
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS verlaengerung_erinnerung3_tage INT DEFAULT 14
    COMMENT 'Tage vor Vertragsende fuer letzte/dringende Erinnerung (0 = deaktiviert)';

-- Text fuer Erinnerungs-E-Mail (optional, sonst Standard-Text)
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS verlaengerung_email_text TEXT DEFAULT NULL
    COMMENT 'Individueller Text fuer Verlaengerungs-Erinnerungs-E-Mail';

-- =====================================================
-- VERTRAEGE-TABELLE: Beitragsgarantie-Felder
-- =====================================================

-- Beitrag ist garantiert bis zu diesem Datum
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS beitrag_garantiert_bis DATE DEFAULT NULL
    COMMENT 'Datum bis zu dem der aktuelle Beitrag garantiert ist';

-- Urspruenglicher Beitrag bei Vertragsabschluss (fuer Vergleich)
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS urspruenglicher_beitrag DECIMAL(10,2) DEFAULT NULL
    COMMENT 'Beitrag bei Vertragsabschluss (fuer Preisvergleich)';

-- Wurde Verlaengerung angeboten?
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS verlaengerung_angeboten_am DATE DEFAULT NULL
    COMMENT 'Datum wann Verlaengerungsangebot gesendet wurde';

-- Hat Mitglied aktiv verlaengert?
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS aktiv_verlaengert_am DATE DEFAULT NULL
    COMMENT 'Datum wann Mitglied aktiv verlaengert hat';

-- Anzahl der Verlaengerungen
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS anzahl_verlaengerungen INT DEFAULT 0
    COMMENT 'Wie oft wurde der Vertrag bereits verlaengert';

-- =====================================================
-- INDEX fuer Performance
-- =====================================================
-- Index fuer Abfrage: "Alle Vertraege die bald auslaufen"
-- CREATE INDEX IF NOT EXISTS idx_vertraege_vertragsende ON vertraege (vertragsende);
-- CREATE INDEX IF NOT EXISTS idx_vertraege_beitrag_garantiert ON vertraege (beitrag_garantiert_bis);
