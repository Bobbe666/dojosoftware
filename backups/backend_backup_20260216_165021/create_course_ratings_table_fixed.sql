-- Tabelle für Kurs-Bewertungen erstellen
CREATE TABLE IF NOT EXISTS kurs_bewertungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  kurs_id INT NOT NULL,
  bewertung TINYINT NOT NULL CHECK (bewertung >= 1 AND bewertung <= 5),
  kommentar TEXT,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Fremdschlüssel
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  FOREIGN KEY (kurs_id) REFERENCES kurse(kurs_id) ON DELETE CASCADE,
  
  -- Eindeutige Kombination: Ein Mitglied kann einen Kurs nur einmal bewerten
  UNIQUE KEY unique_rating (mitglied_id, kurs_id),
  
  -- Indizes für bessere Performance
  INDEX idx_mitglied_id (mitglied_id),
  INDEX idx_kurs_id (kurs_id),
  INDEX idx_bewertung (bewertung),
  INDEX idx_erstellt_am (erstellt_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
































