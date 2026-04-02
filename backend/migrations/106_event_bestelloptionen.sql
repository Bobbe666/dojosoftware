-- ============================================================================
-- EVENT-BESTELLOPTIONEN (z.B. Weißwurstfrühstück)
-- Datum: 2026-02-27
-- ============================================================================

-- Artikel/Optionen pro Event (was kann bestellt werden)
CREATE TABLE IF NOT EXISTS event_bestelloptionen (
  option_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  beschreibung VARCHAR(500) DEFAULT NULL,
  preis DECIMAL(10,2) DEFAULT 0.00,
  einheit VARCHAR(50) DEFAULT 'Stk',
  reihenfolge INT DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Was jeder angemeldete Teilnehmer bestellt hat
CREATE TABLE IF NOT EXISTS event_bestellungen (
  bestell_id INT AUTO_INCREMENT PRIMARY KEY,
  anmeldung_id INT NOT NULL,
  option_id INT NOT NULL,
  menge INT DEFAULT 1,
  UNIQUE KEY unique_anmeldung_option (anmeldung_id, option_id),
  FOREIGN KEY (anmeldung_id) REFERENCES event_anmeldungen(anmeldung_id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES event_bestelloptionen(option_id) ON DELETE CASCADE,
  INDEX idx_anmeldung (anmeldung_id),
  INDEX idx_option (option_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
