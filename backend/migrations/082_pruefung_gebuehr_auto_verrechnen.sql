-- Migration 082: Prüfungsgebühr automatisch verrechnen
-- Zentrale Einstellung pro Termin + individuelle Überschreibung pro Prüfling

-- Zentrale Einstellung auf dem Prüfungstermin (Default = aus)
ALTER TABLE pruefungstermin_vorlagen
  ADD COLUMN IF NOT EXISTS gebuehr_auto_verrechnen TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = Prüfungsgebühr wird automatisch als Rechnung erstellt wenn ein Mitglied zugelassen wird';

-- Individuelle Überschreibung pro Prüfungseintrag (NULL = Termin-Einstellung übernehmen)
ALTER TABLE pruefungen
  ADD COLUMN IF NOT EXISTS gebuehr_auto_verrechnen TINYINT(1) NULL DEFAULT NULL
    COMMENT 'NULL = Termin-Einstellung, 1 = erzwingen, 0 = unterdrücken';

-- Merker: wurde die Rechnung bereits automatisch erstellt?
ALTER TABLE pruefungen
  ADD COLUMN IF NOT EXISTS gebuehr_rechnung_id INT NULL DEFAULT NULL
    COMMENT 'FK zu rechnungen.rechnung_id wenn automatisch erstellt';
