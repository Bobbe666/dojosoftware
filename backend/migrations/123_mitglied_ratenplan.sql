-- =====================================================================================
-- Migration 123: Ratenzahlungsplan für Mitglieder mit Nachzahlungen
-- =====================================================================================

CREATE TABLE IF NOT EXISTS mitglied_ratenplan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  dojo_id INT NOT NULL,
  aktiv TINYINT(1) DEFAULT 1,

  -- Gesamtbetrag der Nachzahlung zum Zeitpunkt der Planerstellung
  ausstehender_betrag DECIMAL(10,2) NOT NULL,

  -- Ratenzahlungsmodell
  modell ENUM('doppelter_beitrag', 'plus_10', 'plus_20', 'freier_betrag') NOT NULL,

  -- Monatlicher Aufschlag in EUR (berechnet oder manuell eingegeben)
  monatlicher_aufschlag DECIMAL(10,2) NOT NULL,

  -- Fortschritt: bisher über Ratenplan abgezahlt
  bereits_abgezahlt DECIMAL(10,2) DEFAULT 0.00,

  notizen TEXT,

  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_dojo (dojo_id),
  INDEX idx_aktiv (aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
