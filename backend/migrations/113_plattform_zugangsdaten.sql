-- Migration 113: Plattform-Zugangsdaten Zentrale
-- Speichert alle Software-Zugangsdaten verschlüsselt

CREATE TABLE IF NOT EXISTS plattform_zugangsdaten (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  kategorie       ENUM('server','datenbank','email','plattform','extern','sonstiges') NOT NULL DEFAULT 'sonstiges',
  name            VARCHAR(200) NOT NULL,
  url             VARCHAR(500) DEFAULT NULL,
  benutzername_enc TEXT DEFAULT NULL,
  passwort_enc     TEXT DEFAULT NULL,
  notizen         TEXT DEFAULT NULL,
  sort_order      INT DEFAULT 0,
  erstellt_am     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
