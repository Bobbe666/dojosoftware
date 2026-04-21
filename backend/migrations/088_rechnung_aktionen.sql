-- Migration 088: Rechnung-Aktionen Tabelle
-- Protokolliert E-Mail-Versand, Drucken und Lastschrift-Einzug

CREATE TABLE IF NOT EXISTS rechnung_aktionen (
  aktion_id INT AUTO_INCREMENT PRIMARY KEY,
  rechnung_id INT NOT NULL,
  aktion_typ ENUM('email_gesendet', 'gedruckt', 'lastschrift_eingezogen') NOT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  erstellt_von INT NULL,
  notiz TEXT NULL,
  INDEX idx_rechnung_id (rechnung_id),
  FOREIGN KEY (rechnung_id) REFERENCES rechnungen(rechnung_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
