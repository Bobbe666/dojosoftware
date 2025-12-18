-- =====================================================================================
-- BENACHRICHTIGUNGEN & OFFENE POSTEN FÜR 10ER-KARTEN
-- =====================================================================================
-- Erweitert das System um Benachrichtigungen und offene Posten
-- =====================================================================================

-- Tabelle für Admin-Benachrichtigungen
CREATE TABLE IF NOT EXISTS benachrichtigungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL COMMENT 'Empfänger der Benachrichtigung (Admin/Trainer)',
  nachricht TEXT NOT NULL,
  typ ENUM('info', 'warnung', 'barzahlung', 'wichtig') DEFAULT 'info',
  gelesen TINYINT(1) DEFAULT 0,
  erstellt_am DATETIME NOT NULL,
  gelesen_am DATETIME,
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  INDEX idx_mitglied_gelesen (mitglied_id, gelesen),
  INDEX idx_erstellt (erstellt_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für offene Posten (Lastschrift)
CREATE TABLE IF NOT EXISTS offene_posten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  zehnerkarte_id INT,
  vertrag_id INT,
  betrag_cents INT NOT NULL,
  beschreibung VARCHAR(255) NOT NULL,
  faellig_am DATE NOT NULL,
  status ENUM('offen', 'gebucht', 'storniert') DEFAULT 'offen',
  zahlungsart ENUM('lastschrift', 'rechnung', 'bar') DEFAULT 'lastschrift',
  gebucht_am DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  FOREIGN KEY (zehnerkarte_id) REFERENCES zehnerkarten(id) ON DELETE SET NULL,
  INDEX idx_mitglied_status (mitglied_id, status),
  INDEX idx_faellig (faellig_am),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- MIGRATION ABGESCHLOSSEN
-- =====================================================================================
