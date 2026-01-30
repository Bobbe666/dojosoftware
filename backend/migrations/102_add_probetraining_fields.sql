-- Migration 102: Probetraining-Buchung Felder
-- Erweitert interessenten Tabelle für Online-Probetraining-Buchung

-- Gewünschter Kurs/Zeitslot
ALTER TABLE interessenten
ADD COLUMN IF NOT EXISTS gewuenschter_kurs_id INT(11) NULL AFTER probetraining_datum,
ADD COLUMN IF NOT EXISTS wunsch_wochentag VARCHAR(20) NULL AFTER gewuenschter_kurs_id,
ADD COLUMN IF NOT EXISTS wunsch_uhrzeit VARCHAR(10) NULL AFTER wunsch_wochentag,
ADD COLUMN IF NOT EXISTS anfrage_quelle ENUM('manuell', 'website', 'probetraining_formular') DEFAULT 'manuell' AFTER erstkontakt_quelle,
ADD COLUMN IF NOT EXISTS probetraining_bestaetigt TINYINT(1) DEFAULT 0 AFTER probetraining_absolviert,
ADD COLUMN IF NOT EXISTS bestaetigung_gesendet_am TIMESTAMP NULL AFTER probetraining_bestaetigt;

-- Index für schnellere Abfragen
ALTER TABLE interessenten ADD INDEX IF NOT EXISTS idx_anfrage_quelle (anfrage_quelle);
ALTER TABLE interessenten ADD INDEX IF NOT EXISTS idx_gewuenschter_kurs (gewuenschter_kurs_id);

-- Foreign Key (optional, falls kurs_id existiert)
-- ALTER TABLE interessenten ADD CONSTRAINT fk_interessent_kurs FOREIGN KEY (gewuenschter_kurs_id) REFERENCES kurse(kurs_id) ON DELETE SET NULL;
