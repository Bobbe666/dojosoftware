-- Migration 037: Vertragseinstellungen zur Dojo-Tabelle hinzufuegen
-- Diese Felder erlauben die zentrale Konfiguration von Vertragsbedingungen pro Dojo

-- Kuendigungsfrist (Standard-Einstellungen fuer neue Vertraege)
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS kuendigungsfrist_monate INT DEFAULT 3 COMMENT 'Standard-Kuendigungsfrist in Monaten';

-- Mindestlaufzeit
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS mindestlaufzeit_monate INT DEFAULT 12 COMMENT 'Standard-Mindestlaufzeit fuer neue Vertraege';

-- Probezeit
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS probezeit_tage INT DEFAULT 14 COMMENT 'Probezeit in Tagen';

-- Kuendigungsbedingungen nach deutschem Recht
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS kuendigung_nur_monatsende BOOLEAN DEFAULT TRUE COMMENT 'Kuendigung nur zum Monatsende moeglich';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS kuendigung_schriftlich BOOLEAN DEFAULT TRUE COMMENT 'Kuendigung muss schriftlich erfolgen';

-- Automatische Verlaengerung
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS automatische_verlaengerung BOOLEAN DEFAULT TRUE COMMENT 'Vertraege verlaengern sich automatisch';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS verlaengerung_monate INT DEFAULT 12 COMMENT 'Verlaengerungszeitraum in Monaten';

-- Kuendigungsfristen differenziert
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS kuendigung_erstlaufzeit_monate INT DEFAULT 3 COMMENT 'Kuendigungsfrist vor Ende der Erstlaufzeit';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS kuendigung_verlaengerung_monate INT DEFAULT 1 COMMENT 'Kuendigungsfrist vor automatischer Verlaengerung';

-- Vertragslaufzeiten und Preise (optional)
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vertrag_3_monate_preis DECIMAL(10,2) DEFAULT NULL COMMENT 'Preis fuer 3-Monats-Vertrag';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vertrag_6_monate_preis DECIMAL(10,2) DEFAULT NULL COMMENT 'Preis fuer 6-Monats-Vertrag';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vertrag_12_monate_preis DECIMAL(10,2) DEFAULT NULL COMMENT 'Preis fuer 12-Monats-Vertrag';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vertrag_3_monate_aktiv BOOLEAN DEFAULT TRUE COMMENT '3-Monats-Vertrag verfuegbar';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vertrag_6_monate_aktiv BOOLEAN DEFAULT TRUE COMMENT '6-Monats-Vertrag verfuegbar';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vertrag_12_monate_aktiv BOOLEAN DEFAULT TRUE COMMENT '12-Monats-Vertrag verfuegbar';

-- Rabatte
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS jahresbeitrag DECIMAL(10,2) DEFAULT NULL COMMENT 'Jahresbeitrag (falls abweichend)';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS familienrabatt_prozent DECIMAL(5,2) DEFAULT NULL COMMENT 'Familienrabatt in Prozent';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS schuelerrabatt_prozent DECIMAL(5,2) DEFAULT NULL COMMENT 'Schuelerrabatt in Prozent';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS vereinsmitglied_rabatt_prozent DECIMAL(5,2) DEFAULT NULL COMMENT 'Vereinsmitglied-Rabatt in Prozent';
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS mehrfachtraining_rabatt_prozent DECIMAL(5,2) DEFAULT NULL COMMENT 'Mehrfachtraining-Rabatt in Prozent';

-- Kuendigungsbestaetigung Dokumenttyp zur ENUM hinzufuegen
-- Hinweis: MySQL erlaubt kein direktes ALTER fuer ENUM mit IF NOT EXISTS
-- Daher wird das separat in der Migration gehandhabt
