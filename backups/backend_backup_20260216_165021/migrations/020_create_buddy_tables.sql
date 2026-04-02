-- Buddy Tabellen anlegen, falls nicht vorhanden

CREATE TABLE IF NOT EXISTS buddy_gruppen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gruppe_name VARCHAR(255) NOT NULL,
  max_mitglieder INT DEFAULT 0,
  aktuelle_mitglieder INT DEFAULT 0,
  ersteller_registrierung_id INT NULL,
  status ENUM('aktiv','archiviert','geloescht') DEFAULT 'aktiv',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS buddy_einladungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  buddy_gruppe_id INT NOT NULL,
  freund_name VARCHAR(255) NULL,
  freund_email VARCHAR(255) NOT NULL,
  einladungs_token VARCHAR(64) NOT NULL UNIQUE,
  token_gueltig_bis DATETIME NOT NULL,
  status ENUM('eingeladen','email_gesendet','registriert','aktiviert','abgelehnt','abgelaufen') DEFAULT 'eingeladen',
  registrierung_id INT NULL,
  mitglied_id INT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  einladung_gesendet_am DATETIME NULL,
  registriert_am DATETIME NULL,
  INDEX idx_buddy_einladungen_gruppe (buddy_gruppe_id),
  INDEX idx_buddy_einladungen_token (einladungs_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS buddy_email_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  buddy_einladung_id INT NOT NULL,
  email_typ ENUM('einladung','erinnerung') NOT NULL,
  empfaenger_email VARCHAR(255) NOT NULL,
  betreff VARCHAR(255) NULL,
  status ENUM('gesendet','fehler') NOT NULL,
  gesendet_am DATETIME NULL,
  provider_message_id VARCHAR(255) NULL,
  fehler_nachricht TEXT NULL,
  INDEX idx_buddy_email_log_einladung (buddy_einladung_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS buddy_aktivitaeten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  buddy_gruppe_id INT NOT NULL,
  buddy_einladung_id INT NULL,
  aktivitaet_typ VARCHAR(64) NOT NULL,
  beschreibung VARCHAR(512) NULL,
  benutzer_ip VARCHAR(64) NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_buddy_aktivitaeten_gruppe (buddy_gruppe_id),
  INDEX idx_buddy_aktivitaeten_einladung (buddy_einladung_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;




















