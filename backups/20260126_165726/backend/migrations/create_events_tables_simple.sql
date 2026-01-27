-- ============================================================================
-- EVENTS SYSTEM - DATENBANKTABELLEN (OHNE FOREIGN KEYS)
-- Datum: 2025-12-03
-- ============================================================================

-- Events Haupttabelle
CREATE TABLE IF NOT EXISTS events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  titel VARCHAR(255) NOT NULL,
  beschreibung TEXT,
  event_typ ENUM('Turnier', 'Lehrgang', 'Prüfung', 'Seminar', 'Workshop', 'Feier', 'Sonstiges') DEFAULT 'Sonstiges',
  datum DATE NOT NULL,
  uhrzeit_beginn TIME,
  uhrzeit_ende TIME,
  ort VARCHAR(255),
  raum_id INT NULL,
  max_teilnehmer INT DEFAULT NULL,
  teilnahmegebuehr DECIMAL(10,2) DEFAULT 0.00,
  anmeldefrist DATE,
  status ENUM('geplant', 'anmeldung_offen', 'ausgebucht', 'abgeschlossen', 'abgesagt') DEFAULT 'geplant',
  trainer_ids TEXT COMMENT 'Komma-getrennte Liste von Trainer-IDs',
  dojo_id INT NOT NULL DEFAULT 1,
  bild_url VARCHAR(500),
  anforderungen TEXT COMMENT 'Voraussetzungen für Teilnahme',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_datum (datum),
  INDEX idx_status (status),
  INDEX idx_dojo (dojo_id),
  INDEX idx_raum (raum_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event-Anmeldungen (Teilnehmer)
CREATE TABLE IF NOT EXISTS event_anmeldungen (
  anmeldung_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  mitglied_id INT NOT NULL,
  anmeldedatum TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('angemeldet', 'bestaetigt', 'abgesagt', 'teilgenommen', 'nicht_erschienen') DEFAULT 'angemeldet',
  bezahlt BOOLEAN DEFAULT FALSE,
  bezahldatum DATETIME,
  bemerkung TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_event_mitglied (event_id, mitglied_id),
  INDEX idx_event (event_id),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event-Dateien (Dokumente, Fotos, etc.)
CREATE TABLE IF NOT EXISTS event_dateien (
  datei_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  dateiname VARCHAR(255) NOT NULL,
  dateipfad VARCHAR(500) NOT NULL,
  dateityp ENUM('dokument', 'bild', 'video', 'sonstiges') DEFAULT 'dokument',
  beschreibung TEXT,
  hochgeladen_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hochgeladen_von INT COMMENT 'Admin/Trainer ID',
  INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event-Kommentare/Nachrichten
CREATE TABLE IF NOT EXISTS event_nachrichten (
  nachricht_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  verfasser_id INT NOT NULL COMMENT 'Mitglied oder Admin ID',
  verfasser_typ ENUM('mitglied', 'admin', 'trainer') DEFAULT 'mitglied',
  nachricht TEXT NOT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
