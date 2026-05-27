-- Plattformweites Umfragetool
CREATE TABLE IF NOT EXISTS umfragen (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  titel         VARCHAR(255) NOT NULL,
  beschreibung  TEXT,
  typ           ENUM('ja_nein', 'kommentar', 'beides') NOT NULL DEFAULT 'ja_nein',
  status        ENUM('entwurf', 'aktiv', 'beendet') NOT NULL DEFAULT 'entwurf',
  ziel_platformen JSON,
  gueltig_bis   DATE,
  erstellt_von  INT,
  erstellt_am   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_gueltig_bis (gueltig_bis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS umfrage_antworten (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  umfrage_id    INT NOT NULL,
  user_id       INT NOT NULL,
  antwort       ENUM('ja', 'nein') DEFAULT NULL,
  kommentar     TEXT,
  beantwortet_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_umfrage (umfrage_id, user_id),
  INDEX idx_umfrage (umfrage_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
