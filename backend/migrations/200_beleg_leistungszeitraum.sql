-- Migration 200: Leistungszeitraum an Belegen (periodengerechte Abgrenzung / RAP)
-- ============================================================================
-- leistung_von/leistung_bis = wirtschaftlicher Zeitraum, dem der Beleg zugeordnet wird
-- (z.B. Jahrespolice 01.01.–31.12.). Ist er gesetzt, verteilt die BWA-Auswertung den
-- Betrag periodengerecht über die Monate; sonst gilt das Belegdatum.

ALTER TABLE buchhaltung_belege
  ADD COLUMN leistung_von DATE NULL COMMENT 'Beginn Leistungs-/Nutzungszeitraum (Abgrenzung)',
  ADD COLUMN leistung_bis DATE NULL COMMENT 'Ende Leistungs-/Nutzungszeitraum (Abgrenzung)';
