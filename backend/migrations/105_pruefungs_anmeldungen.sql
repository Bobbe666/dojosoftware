-- Migration 105: Öffentliche Prüfungsanmeldungen
-- Datum: 2026-02-22

-- 1. oeffentlich-Flag zu pruefungstermin_vorlagen
ALTER TABLE pruefungstermin_vorlagen
  ADD COLUMN oeffentlich TINYINT(1) DEFAULT 0 AFTER teilnahmebedingungen;

-- 2. Neue Tabelle für externe Anmeldungen
CREATE TABLE pruefungs_anmeldungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  termin_id INT NOT NULL,
  vorname VARCHAR(100) NOT NULL,
  nachname VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefon VARCHAR(50),
  verein VARCHAR(255),
  stil_id INT,
  aktueller_gurt VARCHAR(100),
  angestrebter_gurt VARCHAR(100),
  mitglied_id INT NULL,
  bemerkungen TEXT,
  datenschutz_akzeptiert TINYINT(1) DEFAULT 0,
  status ENUM('angemeldet','bestaetigt','abgesagt') DEFAULT 'angemeldet',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (termin_id) REFERENCES pruefungstermin_vorlagen(termin_id) ON DELETE CASCADE,
  INDEX idx_termin (termin_id),
  INDEX idx_email (email)
);
