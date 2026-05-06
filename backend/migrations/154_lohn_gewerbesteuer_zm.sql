-- Migration 154: Lohnabrechnung, Gewerbesteuer, Zusammenfassende Meldung
-- =========================================================================

-- Lohnabrechnung: Erweiterung personal-Tabelle für Payroll
ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS steuerklasse       TINYINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sv_nummer          VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS krankenkasse       VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS krankenkasse_zusatz DECIMAL(4,2) DEFAULT 1.70,
  ADD COLUMN IF NOT EXISTS kinderfreibetrag   DECIMAL(4,1) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS kirchensteuer_land ENUM('Bayern','andere','keine') DEFAULT 'andere',
  ADD COLUMN IF NOT EXISTS steueridentnummer  VARCHAR(20) DEFAULT NULL;

-- Monatliche Lohnabrechnungen
CREATE TABLE IF NOT EXISTS lohnabrechnung (
  abrechnung_id     INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL,
  organisation_name VARCHAR(100) NOT NULL DEFAULT '',
  personal_id       INT NOT NULL,
  monat             TINYINT NOT NULL,
  jahr              INT NOT NULL,
  brutto            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- SV Arbeitnehmer-Anteile
  rv_an             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  av_an             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  kv_an             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pv_an             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- SV Arbeitgeber-Anteile
  rv_ag             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  av_ag             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  kv_ag             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pv_ag             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- Steuern
  lohnsteuer        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  kirchensteuer     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  soli              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- Ergebnisse
  netto             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ag_gesamtkosten   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- Sonderfelder
  sonderzahlung     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sonderzahlung_typ VARCHAR(50) DEFAULT NULL,
  notizen           TEXT DEFAULT NULL,
  erstellt_am       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  erstellt_von      INT DEFAULT NULL,
  UNIQUE KEY uk_personal_monat (personal_id, monat, jahr),
  INDEX idx_dojo_jahr (dojo_id, jahr),
  INDEX idx_personal (personal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gewerbesteuer-Einstellungen pro Dojo
CREATE TABLE IF NOT EXISTS gewerbesteuer_einstellungen (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL UNIQUE,
  organisation_name VARCHAR(100) NOT NULL DEFAULT '',
  hebesatz          INT NOT NULL DEFAULT 400,
  gemeinde          VARCHAR(100) DEFAULT NULL,
  ist_gewerbesteuerpflichtig TINYINT(1) NOT NULL DEFAULT 1,
  hinzurechnungen_miete DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  hinzurechnungen_leasing DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  hinzurechnungen_zinsen DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  kuerz_grundbesitz DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  aktualisiert_am   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gewerbesteuer-Jahresberechnungen
CREATE TABLE IF NOT EXISTS gewerbesteuer_berechnung (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL,
  jahr              INT NOT NULL,
  gewerbeertrag_roh DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  hinzurechnungen   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  kuerzungen        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  freibetrag        DECIMAL(12,2) NOT NULL DEFAULT 24500.00,
  steuermessbetrag  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  hebesatz          INT NOT NULL DEFAULT 400,
  gewerbesteuer     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  festgesetzt_am    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dojo_jahr (dojo_id, jahr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zusammenfassende Meldung (ZM)
CREATE TABLE IF NOT EXISTS zm_meldungen (
  zm_id             INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL,
  organisation_name VARCHAR(100) NOT NULL DEFAULT '',
  jahr              INT NOT NULL,
  quartal           TINYINT NOT NULL,
  betrag_gesamt     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  meldung_status    ENUM('entwurf','eingereicht') NOT NULL DEFAULT 'entwurf',
  eingereicht_am    DATETIME DEFAULT NULL,
  xml_dateiname     VARCHAR(255) DEFAULT NULL,
  notizen           TEXT DEFAULT NULL,
  erstellt_am       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo_jahr (dojo_id, jahr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ZM-Positionen (pro EU-Kunde)
CREATE TABLE IF NOT EXISTS zm_positionen (
  position_id       INT AUTO_INCREMENT PRIMARY KEY,
  zm_id             INT NOT NULL,
  ust_id_empfaenger VARCHAR(30) NOT NULL,
  land_code         VARCHAR(2) NOT NULL,
  betrag            DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  art               ENUM('lieferung','sonstige_leistung') NOT NULL DEFAULT 'sonstige_leistung',
  FOREIGN KEY (zm_id) REFERENCES zm_meldungen(zm_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
