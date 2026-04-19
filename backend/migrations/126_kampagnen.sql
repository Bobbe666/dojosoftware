-- ============================================================================
-- Migration 126: Kampagnen-Versand
-- Protokolliert gesendete E-Mail-Kampagnen (Akquise & Lizenzinhaber)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kampagnen_versand (
  id INT AUTO_INCREMENT PRIMARY KEY,
  typ ENUM('akquise','lizenzinhaber') NOT NULL,
  betreff VARCHAR(500),
  empfaenger_anzahl INT DEFAULT 0,
  gesendet_anzahl INT DEFAULT 0,
  fehler_anzahl INT DEFAULT 0,
  status ENUM('gesendet','teilweise','fehler') DEFAULT 'gesendet',
  filter_info TEXT COMMENT 'JSON: angewendete Filter',
  erstellt_von_user_id INT,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kampagnen_empfaenger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kampagne_id INT NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  status ENUM('gesendet','fehler') DEFAULT 'gesendet',
  fehler_info TEXT,
  FOREIGN KEY (kampagne_id) REFERENCES kampagnen_versand(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_kampagnen_versand_typ ON kampagnen_versand(typ);
CREATE INDEX idx_kampagnen_versand_am  ON kampagnen_versand(erstellt_am);
CREATE INDEX idx_kampagnen_empf_kamp   ON kampagnen_empfaenger(kampagne_id);
