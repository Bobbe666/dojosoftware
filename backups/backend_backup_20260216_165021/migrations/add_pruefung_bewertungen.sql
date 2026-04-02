-- Migration: Prüfungsbewertungen für einzelne Techniken
-- Erstellt eine Tabelle zum Speichern der detaillierten Bewertungen

USE dojo;

-- Tabelle für detaillierte Bewertungen pro Prüfungsinhalt
CREATE TABLE IF NOT EXISTS pruefung_bewertungen (
  bewertung_id INT PRIMARY KEY AUTO_INCREMENT,
  pruefung_id INT NOT NULL,
  inhalt_id INT NOT NULL,
  bestanden BOOLEAN DEFAULT NULL COMMENT 'Ob diese Technik bestanden wurde',
  punktzahl DECIMAL(5,2) DEFAULT NULL COMMENT 'Erreichte Punktzahl für diese Technik',
  max_punktzahl DECIMAL(5,2) DEFAULT 10.00 COMMENT 'Maximale Punktzahl für diese Technik',
  kommentar TEXT DEFAULT NULL COMMENT 'Kommentar des Prüfers zu dieser Technik',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (pruefung_id) REFERENCES pruefungen(pruefung_id) ON DELETE CASCADE,
  FOREIGN KEY (inhalt_id) REFERENCES pruefungsinhalte(inhalt_id) ON DELETE CASCADE,

  UNIQUE KEY unique_pruefung_inhalt (pruefung_id, inhalt_id),
  INDEX idx_pruefung (pruefung_id),
  INDEX idx_inhalt (inhalt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zeige Erfolg
SELECT 'Tabelle pruefung_bewertungen erfolgreich erstellt' AS Status;
