-- =====================================================================================
-- 10ER-KARTEN SYSTEM
-- =====================================================================================
-- Erstellt Tabellen für 10er-Karten Verwaltung und Check-in Tracking
-- =====================================================================================

-- Tabelle für 10er-Karten
CREATE TABLE IF NOT EXISTS zehnerkarten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  tarif_id INT NOT NULL,
  gekauft_am DATE NOT NULL,
  gueltig_bis DATE NOT NULL,
  einheiten_gesamt INT NOT NULL DEFAULT 10,
  einheiten_verbleibend INT NOT NULL DEFAULT 10,
  status ENUM('aktiv', 'aufgebraucht', 'abgelaufen') DEFAULT 'aktiv',
  preis_cents INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  FOREIGN KEY (tarif_id) REFERENCES tarife(id),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_status (status),
  INDEX idx_gueltig_bis (gueltig_bis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Check-in Buchungen
CREATE TABLE IF NOT EXISTS zehnerkarten_buchungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zehnerkarte_id INT NOT NULL,
  mitglied_id INT NOT NULL,
  buchungsdatum DATE NOT NULL,
  buchungszeit DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  einheiten INT NOT NULL DEFAULT 1,
  notiz VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (zehnerkarte_id) REFERENCES zehnerkarten(id) ON DELETE CASCADE,
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  INDEX idx_zehnerkarte (zehnerkarte_id),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_buchungsdatum (buchungsdatum),
  UNIQUE KEY unique_daily_booking (zehnerkarte_id, buchungsdatum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- MIGRATION ABGESCHLOSSEN
-- =====================================================================================
