-- News Articles Tabelle
-- Für zentrale News-Verwaltung durch Haupt-Admin

CREATE TABLE IF NOT EXISTS news_articles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  titel VARCHAR(255) NOT NULL,
  inhalt TEXT NOT NULL,
  kurzbeschreibung VARCHAR(500),
  zielgruppe ENUM('homepage', 'alle_dojos') DEFAULT 'alle_dojos',
  status ENUM('entwurf', 'veroeffentlicht', 'archiviert') DEFAULT 'entwurf',
  autor_id INT NOT NULL,
  veroeffentlicht_am DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_status (status),
  INDEX idx_zielgruppe (zielgruppe),
  INDEX idx_veroeffentlicht (veroeffentlicht_am)
);

-- News-Leser Tracking (optional - für später)
CREATE TABLE IF NOT EXISTS news_gelesen (
  id INT PRIMARY KEY AUTO_INCREMENT,
  news_id INT NOT NULL,
  mitglied_id INT NOT NULL,
  gelesen_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (news_id) REFERENCES news_articles(id) ON DELETE CASCADE,
  UNIQUE KEY unique_news_mitglied (news_id, mitglied_id)
);
