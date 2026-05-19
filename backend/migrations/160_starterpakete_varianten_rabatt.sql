-- Starterpaket-Positionen: Rabatt + Varianten
ALTER TABLE starterpaket_positionen
  ADD COLUMN IF NOT EXISTS rabatt_prozent  DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS originalpreis_cent INT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hat_varianten   TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS varianten_options TEXT        DEFAULT NULL;

-- Starterpaket-Bestellungen: Varianten-Auswahl des Mitglieds
CREATE TABLE IF NOT EXISTS starterpaket_bestellungen (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id          INT NOT NULL,
  paket_id         INT NOT NULL,
  mitglied_id      INT NOT NULL,
  gesamtpreis_cent INT NOT NULL DEFAULT 0,
  status           ENUM('offen','bezahlt','storniert') NOT NULL DEFAULT 'offen',
  varianten_json   TEXT DEFAULT NULL,
  erstellt_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo    (dojo_id),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE starterpaket_bestellungen
  ADD COLUMN IF NOT EXISTS varianten_json TEXT DEFAULT NULL;
