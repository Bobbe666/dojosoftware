-- ============================================================
-- Migration 145: Support-Ticket-System + Wunschliste (Enterprise)
-- ============================================================

-- 1. Support-Tickets Haupttabelle
CREATE TABLE IF NOT EXISTS support_tickets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_nummer VARCHAR(20) UNIQUE NOT NULL,

  ersteller_typ ENUM('user', 'mitglied', 'admin') NOT NULL,
  ersteller_id INT NOT NULL,
  ersteller_name VARCHAR(200),
  ersteller_email VARCHAR(255),

  bereich ENUM('dojo', 'verband', 'org') NOT NULL DEFAULT 'dojo',
  dojo_id INT NULL,

  kategorie ENUM('vertrag', 'hilfe', 'problem', 'sonstiges') NOT NULL,
  betreff VARCHAR(255) NOT NULL,
  prioritaet ENUM('niedrig', 'mittel', 'hoch', 'kritisch') DEFAULT 'mittel',

  status ENUM('offen', 'in_bearbeitung', 'warten_auf_antwort', 'erledigt', 'geschlossen') DEFAULT 'offen',

  zugewiesen_an INT NULL,
  zugewiesen_am DATETIME NULL,

  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  erledigt_am DATETIME NULL,

  INDEX idx_dojo (dojo_id),
  INDEX idx_status (status),
  INDEX idx_ersteller (ersteller_typ, ersteller_id),
  INDEX idx_bereich (bereich),
  INDEX idx_ticket_nummer (ticket_nummer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Ticket-Nachrichten
CREATE TABLE IF NOT EXISTS support_ticket_nachrichten (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  absender_typ ENUM('user', 'mitglied', 'admin') NOT NULL,
  absender_id INT NOT NULL,
  absender_name VARCHAR(200),
  nachricht TEXT NOT NULL,
  ist_intern BOOLEAN DEFAULT FALSE,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket (ticket_id),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Ticket-Anhänge
CREATE TABLE IF NOT EXISTS support_ticket_anhaenge (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  dateiname VARCHAR(255) NOT NULL,
  originaler_dateiname VARCHAR(255),
  dateityp VARCHAR(100),
  dateigröße INT,
  pfad VARCHAR(500),
  hochgeladen_von INT,
  hochgeladen_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket (ticket_id),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Ticket-Nummern-Sequenz
CREATE TABLE IF NOT EXISTS support_ticket_nummern (
  id INT PRIMARY KEY AUTO_INCREMENT,
  jahr INT NOT NULL,
  laufnummer INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_jahr (jahr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initialer Eintrag für aktuelles Jahr
INSERT IGNORE INTO support_ticket_nummern (jahr, laufnummer)
VALUES (YEAR(NOW()), 0);

-- 5. Feature-Requests (Wunschliste)
CREATE TABLE IF NOT EXISTS feature_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  titel VARCHAR(255) NOT NULL,
  beschreibung TEXT,
  kategorie ENUM('funktion', 'verbesserung', 'integration', 'design', 'sonstiges') DEFAULT 'funktion',
  status ENUM('neu', 'geprueft', 'geplant', 'in_arbeit', 'umgesetzt', 'abgelehnt') DEFAULT 'neu',
  prioritaet ENUM('niedrig', 'mittel', 'hoch') DEFAULT 'mittel',
  ersteller_typ ENUM('user', 'mitglied', 'admin') NOT NULL,
  ersteller_id INT NOT NULL,
  dojo_id INT NULL,
  votes_count INT DEFAULT 0,
  admin_kommentar TEXT NULL,
  bearbeitet_von INT NULL,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_votes (votes_count),
  INDEX idx_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Feature-Votes
CREATE TABLE IF NOT EXISTS feature_votes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  feature_id INT NOT NULL,
  user_typ ENUM('user', 'mitglied', 'admin') NOT NULL,
  user_id INT NOT NULL,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_vote (feature_id, user_typ, user_id),
  FOREIGN KEY (feature_id) REFERENCES feature_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. feature_support Spalte in dojo_subscriptions
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'dojo_subscriptions' AND column_name = 'feature_support') = 0,
  'ALTER TABLE dojo_subscriptions ADD COLUMN feature_support BOOLEAN DEFAULT FALSE COMMENT ''Support-Ticket-System + Wunschliste (Enterprise)''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8. feature_support Spalte in subscription_plans
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'subscription_plans' AND column_name = 'feature_support') = 0,
  'ALTER TABLE subscription_plans ADD COLUMN feature_support BOOLEAN DEFAULT FALSE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9. Enterprise + Professional aktivieren
UPDATE subscription_plans SET feature_support = TRUE WHERE plan_name IN ('enterprise', 'professional');
UPDATE dojo_subscriptions  SET feature_support = TRUE WHERE plan_type  IN ('enterprise', 'professional');
