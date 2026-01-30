-- ============================================================================
-- Support-Ticketsystem Tabellen
-- Migration: 101_create_support_ticket_tables.sql
-- ============================================================================

-- Haupttabelle: Support-Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_nummer VARCHAR(20) UNIQUE NOT NULL,

  -- Ersteller
  ersteller_typ ENUM('user', 'mitglied', 'admin') NOT NULL,
  ersteller_id INT NOT NULL,
  ersteller_name VARCHAR(200),
  ersteller_email VARCHAR(255),

  -- Kontext
  bereich ENUM('dojo', 'verband', 'org') NOT NULL DEFAULT 'dojo',
  dojo_id INT NULL,

  -- Ticket-Daten
  kategorie ENUM('vertrag', 'hilfe', 'problem', 'sonstiges') NOT NULL,
  betreff VARCHAR(255) NOT NULL,
  prioritaet ENUM('niedrig', 'mittel', 'hoch', 'kritisch') DEFAULT 'mittel',

  -- Status
  status ENUM('offen', 'in_bearbeitung', 'warten_auf_antwort', 'erledigt', 'geschlossen') DEFAULT 'offen',

  -- Zuweisung
  zugewiesen_an INT NULL,
  zugewiesen_am DATETIME NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  erledigt_am DATETIME NULL,
  geschlossen_am DATETIME NULL,

  -- Indexes
  INDEX idx_status (status),
  INDEX idx_bereich (bereich),
  INDEX idx_kategorie (kategorie),
  INDEX idx_ersteller (ersteller_typ, ersteller_id),
  INDEX idx_dojo (dojo_id),
  INDEX idx_zugewiesen (zugewiesen_an),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nachrichten/Antworten zu Tickets
CREATE TABLE IF NOT EXISTS support_ticket_nachrichten (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,

  -- Absender
  absender_typ ENUM('ersteller', 'bearbeiter', 'system') NOT NULL,
  absender_id INT NULL,
  absender_name VARCHAR(200),

  -- Nachricht
  nachricht TEXT NOT NULL,
  ist_intern TINYINT(1) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  INDEX idx_ticket (ticket_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datei-Anhänge
CREATE TABLE IF NOT EXISTS support_ticket_anhaenge (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  nachricht_id INT NULL,

  dateiname VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  dateityp VARCHAR(100),
  dateigroesse INT,
  pfad VARCHAR(500) NOT NULL,

  hochgeladen_von INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  INDEX idx_ticket (ticket_id),
  INDEX idx_nachricht (nachricht_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ticket-Nummern Sequenz
CREATE TABLE IF NOT EXISTS support_ticket_nummern (
  jahr INT PRIMARY KEY,
  aktuelle_nummer INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initiale Nummer für aktuelles Jahr
INSERT IGNORE INTO support_ticket_nummern (jahr, aktuelle_nummer) VALUES (YEAR(NOW()), 0);
