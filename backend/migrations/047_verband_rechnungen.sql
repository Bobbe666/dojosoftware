-- Migration: Verband-Rechnungen für TDA International
-- Datum: 2026-02-02

-- Tabelle für Verbandsrechnungen
CREATE TABLE IF NOT EXISTS verband_rechnungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rechnungsnummer VARCHAR(50) NOT NULL UNIQUE,

  -- Empfänger
  empfaenger_typ ENUM('verbandsmitglied', 'software_nutzer', 'manuell') NOT NULL,
  empfaenger_id INT DEFAULT NULL,
  empfaenger_name VARCHAR(255),
  empfaenger_adresse TEXT,
  empfaenger_email VARCHAR(255),

  -- Daten
  rechnungsdatum DATE NOT NULL,
  leistungsdatum DATE,
  faellig_am DATE NOT NULL,

  -- Beträge
  summe_netto DECIMAL(10,2) NOT NULL DEFAULT 0,
  summe_mwst DECIMAL(10,2) NOT NULL DEFAULT 0,
  summe_brutto DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Status
  status ENUM('offen', 'bezahlt', 'storniert', 'mahnung') NOT NULL DEFAULT 'offen',
  bezahlt_am DATE DEFAULT NULL,

  -- Sonstiges
  notizen TEXT,
  zahlungsbedingungen TEXT,

  -- Timestamps
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_rechnungsnummer (rechnungsnummer),
  INDEX idx_empfaenger (empfaenger_typ, empfaenger_id),
  INDEX idx_status (status),
  INDEX idx_faellig (faellig_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Rechnungspositionen
CREATE TABLE IF NOT EXISTS verband_rechnungspositionen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rechnung_id INT NOT NULL,
  position_nr INT NOT NULL DEFAULT 1,

  bezeichnung VARCHAR(500) NOT NULL,
  menge DECIMAL(10,2) NOT NULL DEFAULT 1,
  einheit VARCHAR(50) DEFAULT 'Stück',
  einzelpreis DECIMAL(10,2) NOT NULL,
  mwst_satz DECIMAL(5,2) NOT NULL DEFAULT 19.00,

  netto DECIMAL(10,2) NOT NULL,
  mwst DECIMAL(10,2) NOT NULL,
  brutto DECIMAL(10,2) NOT NULL,

  FOREIGN KEY (rechnung_id) REFERENCES verband_rechnungen(id) ON DELETE CASCADE,
  INDEX idx_rechnung (rechnung_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fertig
SELECT 'Migration 047_verband_rechnungen erfolgreich' AS status;
