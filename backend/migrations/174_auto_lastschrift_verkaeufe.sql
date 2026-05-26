-- Auto-Lastschrift für Artikelverkäufe
-- Fügt Setting + ENUM-Wert + Protokoll-Tabelle hinzu

-- 1. Setting-Spalte in dojo-Tabelle
ALTER TABLE dojo
  ADD COLUMN IF NOT EXISTS auto_lastschrift_verkaeufe TINYINT(1) NOT NULL DEFAULT 0;

-- 2. 'in_einzug' als gültiger Status für Verkäufe
ALTER TABLE verkaeufe
  MODIFY COLUMN zahlungsstatus ENUM('offen', 'bezahlt', 'in_einzug') NOT NULL DEFAULT 'bezahlt';

-- 3. Protokoll-Tabelle für automatische Läufe
CREATE TABLE IF NOT EXISTS lastschrift_auto_protokoll (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id         INT NOT NULL,
  erstellt_am     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  anzahl_verkaeufe INT NOT NULL DEFAULT 0,
  gesamt_betrag_cent BIGINT NOT NULL DEFAULT 0,
  csv_inhalt      MEDIUMTEXT,
  status          ENUM('verarbeitet', 'fehler') NOT NULL DEFAULT 'verarbeitet',
  fehler_meldung  TEXT,
  gelesen         TINYINT(1) NOT NULL DEFAULT 0,
  gelesen_am      DATETIME,
  INDEX idx_dojo_gelesen (dojo_id, gelesen),
  INDEX idx_erstellt (erstellt_am)
);
