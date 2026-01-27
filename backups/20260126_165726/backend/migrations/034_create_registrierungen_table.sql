-- Migration 034: Registrierungen Tabelle erstellen
-- Speichert laufende Mitglieder-Registrierungen mit allen Schritten

CREATE TABLE IF NOT EXISTS registrierungen (
  id INT NOT NULL AUTO_INCREMENT,

  -- Grunddaten (Schritt 1)
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  verification_token VARCHAR(64) DEFAULT NULL,
  token_expires_at DATETIME DEFAULT NULL,
  email_verified_at DATETIME DEFAULT NULL,

  -- Persönliche Daten (Schritt 2)
  vorname VARCHAR(100) DEFAULT NULL,
  nachname VARCHAR(100) DEFAULT NULL,
  geburtsdatum DATE DEFAULT NULL,
  geschlecht ENUM('m', 'w', 'd') DEFAULT NULL,
  strasse VARCHAR(255) DEFAULT NULL,
  hausnummer VARCHAR(20) DEFAULT NULL,
  plz VARCHAR(10) DEFAULT NULL,
  ort VARCHAR(100) DEFAULT NULL,
  telefon VARCHAR(50) DEFAULT NULL,

  -- Bankdaten (Schritt 3)
  iban VARCHAR(34) DEFAULT NULL,
  bic VARCHAR(11) DEFAULT NULL,
  bank_name VARCHAR(100) DEFAULT NULL,
  kontoinhaber VARCHAR(100) DEFAULT NULL,

  -- Tarifauswahl (Schritt 4)
  tarif_id INT DEFAULT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monatlich',
  payment_method VARCHAR(20) DEFAULT 'lastschrift',
  vertragsbeginn DATE DEFAULT NULL,

  -- Gesundheitsfragen (Schritt 5)
  gesundheitsfragen JSON DEFAULT NULL,

  -- Rechtliche Zustimmungen (Schritt 6)
  agb_accepted BOOLEAN DEFAULT FALSE,
  dsgvo_accepted BOOLEAN DEFAULT FALSE,
  widerrufsrecht_acknowledged BOOLEAN DEFAULT FALSE,
  kuendigungshinweise_acknowledged BOOLEAN DEFAULT FALSE,

  -- Familien-Registrierung
  familien_session_id VARCHAR(64) DEFAULT NULL COMMENT 'Gruppiert Familienmitglieder die zusammen registriert werden',
  familie_position INT DEFAULT 1 COMMENT 'Position in Familien-Registrierung',
  teilt_bankdaten_mit INT DEFAULT NULL COMMENT 'ID des Mitglieds dessen Bankdaten geteilt werden',
  teilt_adresse_mit INT DEFAULT NULL COMMENT 'ID des Mitglieds dessen Adresse geteilt wird',

  -- Vertreter für Minderjährige
  vertreter1_typ VARCHAR(50) DEFAULT NULL COMMENT 'erziehungsberechtigter, vormund, sonstige',
  vertreter1_name VARCHAR(200) DEFAULT NULL,
  vertreter1_telefon VARCHAR(50) DEFAULT NULL,
  vertreter1_email VARCHAR(255) DEFAULT NULL,

  -- Status
  status ENUM(
    'email_pending',
    'email_verified',
    'personal_data_complete',
    'bank_data_complete',
    'tariff_selected',
    'health_questions_complete',
    'registration_complete',
    'approved',
    'rejected'
  ) DEFAULT 'email_pending',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  approved_by INT DEFAULT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY unique_email (email),
  KEY idx_status (status),
  KEY idx_verification_token (verification_token),
  KEY idx_familien_session (familien_session_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
