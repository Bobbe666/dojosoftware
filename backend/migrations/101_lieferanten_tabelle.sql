CREATE TABLE IF NOT EXISTS lieferanten (
  lieferant_id   INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id        INT NOT NULL,

  -- Firma
  firmenname     VARCHAR(200) NOT NULL,
  ansprechpartner VARCHAR(100),
  rechtsform     VARCHAR(50),

  -- Kontakt
  email          VARCHAR(100),
  telefon        VARCHAR(30),
  telefon_mobil  VARCHAR(30),
  fax            VARCHAR(30),
  website        VARCHAR(200),

  -- Adresse
  strasse        VARCHAR(100),
  hausnummer     VARCHAR(10),
  plz            VARCHAR(20),
  ort            VARCHAR(100),
  land           VARCHAR(100) DEFAULT 'Deutschland',

  -- International / Steuer / Zoll
  ust_id                 VARCHAR(30),
  eori_nummer            VARCHAR(30),
  handelsreg_nr          VARCHAR(50),
  handelsreg_gericht     VARCHAR(100),
  zolltarifnummer        VARCHAR(20),
  ursprungsland          VARCHAR(100),

  -- Konditionen
  waehrung               VARCHAR(10) DEFAULT 'EUR',
  zahlungsziel_tage      INT DEFAULT 30,
  skonto_prozent         DECIMAL(5,2) DEFAULT 0,
  skonto_tage            INT DEFAULT 0,
  mindestbestellwert_cent INT DEFAULT 0,
  lieferzeit_tage        INT,

  -- Bankdaten (SEPA + international)
  bank_name              VARCHAR(100),
  bank_iban              VARCHAR(34),
  bank_bic               VARCHAR(11),
  bank_kontoinhaber      VARCHAR(100),
  swift_code             VARCHAR(20),
  routing_number         VARCHAR(20),
  account_number         VARCHAR(50),

  -- Meta
  aktiv                  TINYINT(1) DEFAULT 1,
  bemerkungen            TEXT,
  erstellt_am            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_dojo (dojo_id),
  INDEX idx_aktiv (aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
