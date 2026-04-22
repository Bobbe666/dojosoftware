-- =============================================================================
-- MARKETING KI FEATURES
-- Templates, Newsletter-Kampagnen
-- =============================================================================

CREATE TABLE IF NOT EXISTS marketing_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  kategorie ENUM('training','pruefung','angebot','event','tipp','geburtstag','allgemein') DEFAULT 'allgemein',
  plattform ENUM('facebook','instagram','beide','story') DEFAULT 'beide',
  content TEXT NOT NULL,
  hashtags TEXT,
  tonalitaet VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_kategorie (kategorie)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS marketing_newsletter_campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  betreff VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  empfaenger_filter JSON,
  status ENUM('draft','sent','failed') DEFAULT 'draft',
  empfaenger_anzahl INT DEFAULT 0,
  gesendet_at TIMESTAMP NULL,
  erstellt_von INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
