-- Migration 107: Event-Gesehen-Tracking für Mitglieder-Popups
-- Speichert ob ein Mitglied den Popup-Hinweis für ein Event gesehen/beantwortet hat

CREATE TABLE IF NOT EXISTS event_gesehen (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  event_id    INT NOT NULL,
  aktion      ENUM('gesehen', 'angemeldet', 'abgelehnt') DEFAULT 'gesehen',
  zeitpunkt   DATETIME DEFAULT NOW(),
  UNIQUE KEY unique_mitglied_event (mitglied_id, event_id),
  INDEX idx_mitglied (mitglied_id),
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
