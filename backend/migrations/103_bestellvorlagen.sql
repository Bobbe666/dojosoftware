CREATE TABLE IF NOT EXISTS bestellvorlagen (
  vorlage_id       INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id          INT NOT NULL,
  name             VARCHAR(200) NOT NULL,
  typ              VARCHAR(50)  DEFAULT 'karate_gi',
  lieferant_id     INT          DEFAULT NULL,
  modell           VARCHAR(10)  DEFAULT '128',
  modell_name      VARCHAR(200),
  artikel_nr_vorl  VARCHAR(50),
  farbe            VARCHAR(100) DEFAULT 'Weiß',
  wkf              TINYINT(1)   DEFAULT 0,
  stickerei_pos    TEXT,
  stickerei_text   VARCHAR(200),
  stickerei_farben VARCHAR(200) DEFAULT 'Gold, Schwarz',
  stickerei_datei  VARCHAR(200),
  bemerkungen      TEXT,
  aktiv            TINYINT(1)   DEFAULT 1,
  erstellt_am      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE artikel
  ADD COLUMN IF NOT EXISTS vorlage_id INT DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_vorlage (vorlage_id);
