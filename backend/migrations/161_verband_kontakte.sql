-- Verband Kontaktdatenbank: Kampfsportschulen & Vereine (potenzielle TDA-Mitglieder)

CREATE TABLE IF NOT EXISTS verband_kontakte (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  adresse VARCHAR(255) NULL,
  plz VARCHAR(10) NULL,
  ort VARCHAR(100) NULL,
  bundesland VARCHAR(100) NULL,
  land VARCHAR(100) DEFAULT 'Deutschland',
  kontakt_person VARCHAR(150) NULL,
  email VARCHAR(255) NULL,
  telefon VARCHAR(50) NULL,
  website VARCHAR(255) NULL,
  kampfkunst VARCHAR(150) NULL,
  status ENUM('neu','kontaktiert','interessiert','mitglied','kein_interesse','archiviert') DEFAULT 'neu',
  notizen TEXT NULL,
  naechste_aktion_datum DATE NULL,
  naechste_aktion VARCHAR(255) NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_bundesland (bundesland),
  INDEX idx_naechste_aktion_datum (naechste_aktion_datum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS verband_kontakt_aktivitaeten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kontakt_id INT NOT NULL,
  typ ENUM('anruf','email','brief','treffen','online','messe','sonstiges') DEFAULT 'email',
  datum DATETIME NOT NULL,
  betreff VARCHAR(255) NULL,
  notizen TEXT NULL,
  ergebnis VARCHAR(255) NULL,
  naechste_aktion VARCHAR(255) NULL,
  naechste_aktion_datum DATE NULL,
  erstellt_von INT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kontakt_id (kontakt_id),
  INDEX idx_datum (datum),
  FOREIGN KEY (kontakt_id) REFERENCES verband_kontakte(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
