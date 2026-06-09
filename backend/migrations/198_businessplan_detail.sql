-- Migration 198: Businessplan — monatsgenaue Eingabe-Tiefe
-- ============================================================================
-- Ergänzt: monatsgenaue Eingabe (JSON-Arrays mit 12 Werten), AfA-Detail
-- (Satz/Restbuchwert), Personal-Detail (Art/Funktion), Kapitaldienst-Auszahlmonat.
-- Plain ALTER (einmalig ausgeführt; läuft auf MySQL lokal + MariaDB Prod).

-- Umsatz: Menge je Einzelmonat (Array[12]); fehlt → menge_monatlich konstant
ALTER TABLE businessplan_umsatz
  ADD COLUMN mengen_monate JSON NULL COMMENT 'Array[12] Mengen je Monat (überschreibt menge_monatlich)';

-- Kosten: Betrag je Einzelmonat + Personal-Detail
ALTER TABLE businessplan_kosten
  ADD COLUMN betraege_monate JSON NULL COMMENT 'Array[12] Beträge je Monat (überschreibt betrag_monatlich)',
  ADD COLUMN personalart ENUM('','sv_pflichtig','geringfuegig','sv_befreit') DEFAULT '' COMMENT 'nur bei kategorie=personal',
  ADD COLUMN funktion VARCHAR(255) NULL COMMENT 'Funktion/Position des Mitarbeiters';

-- Privatentnahmen: Betrag je Einzelmonat
ALTER TABLE businessplan_privatentnahmen
  ADD COLUMN betraege_monate JSON NULL COMMENT 'Array[12] Beträge je Monat (überschreibt betrag_monatlich)';

-- Investitionen: AfA-Detail (Satz % alternativ zur Nutzungsdauer) + Restbuchwert
ALTER TABLE businessplan_investitionen
  ADD COLUMN afa_satz_prozent DECIMAL(6,3) NOT NULL DEFAULT 0 COMMENT 'AfA-Satz % p.a. (alternativ zu nutzungsdauer_jahre)',
  ADD COLUMN restbuchwert DECIMAL(12,2) NULL COMMENT 'Restbuchwert (bei Gebraucht-Übernahme)';

-- Finanzierung: Auszahlmonat des Darlehens (für Liquidität)
ALTER TABLE businessplan_finanzierung
  ADD COLUMN auszahlung_monat INT NOT NULL DEFAULT 1 COMMENT 'Monat der Darlehensauszahlung (1..12)';
