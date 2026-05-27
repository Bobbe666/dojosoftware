-- Umfragen: Bild-Upload + Datumsabfragen
ALTER TABLE umfragen
  ADD COLUMN bild_url VARCHAR(500) NULL AFTER beschreibung,
  ADD COLUMN daten JSON NULL AFTER ziel_platformen,
  MODIFY COLUMN typ ENUM('ja_nein', 'kommentar', 'beides', 'datum_auswahl') NOT NULL DEFAULT 'ja_nein';

-- Antworten für Datumsabfragen (welche Termine kommt ein Mitglied)
CREATE TABLE IF NOT EXISTS umfrage_datum_antworten (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  umfrage_id    INT NOT NULL,
  user_id       INT NOT NULL,
  datum         DATE NOT NULL,
  kommt         TINYINT(1) DEFAULT 1,
  erstellt_am   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_datum (umfrage_id, user_id, datum),
  INDEX idx_umfrage_datum (umfrage_id, datum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
