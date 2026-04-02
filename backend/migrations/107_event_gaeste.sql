-- ============================================================================
-- EVENT-GÄSTE
-- Datum: 2026-02-27
-- ============================================================================

-- Anzahl Gäste pro Mitglieds-Anmeldung
ALTER TABLE event_anmeldungen
  ADD COLUMN IF NOT EXISTS gaeste_anzahl INT DEFAULT 0 AFTER status;

-- Externe Gäste (kein Account, z.B. anderes Dojo)
CREATE TABLE IF NOT EXISTS event_gaeste (
  gast_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  vorname VARCHAR(100) NOT NULL,
  nachname VARCHAR(100) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  telefon VARCHAR(50) DEFAULT NULL,
  anzahl INT DEFAULT 1,
  bemerkung VARCHAR(500) DEFAULT NULL,
  anmeldedatum DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('angemeldet','bestaetigt','abgesagt') DEFAULT 'angemeldet',
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bestellungen für externe Gäste
CREATE TABLE IF NOT EXISTS event_gast_bestellungen (
  bestell_id INT AUTO_INCREMENT PRIMARY KEY,
  gast_id INT NOT NULL,
  option_id INT NOT NULL,
  menge INT DEFAULT 1,
  UNIQUE KEY unique_gast_option (gast_id, option_id),
  FOREIGN KEY (gast_id) REFERENCES event_gaeste(gast_id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES event_bestelloptionen(option_id) ON DELETE CASCADE,
  INDEX idx_gast (gast_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
