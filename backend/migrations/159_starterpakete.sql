-- Migration 159: Starterpakete für Neumitglieder
-- Ein Starterpaket je Stil, konfigurierbar in Tarife & Preise

CREATE TABLE IF NOT EXISTS starterpakete (
  paket_id         INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id          INT NOT NULL,
  stil_id          INT NOT NULL,
  name             VARCHAR(200) NOT NULL,
  beschreibung     TEXT,
  hinweis          TEXT,
  rabatt_prozent   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  aktiv            TINYINT(1)   NOT NULL DEFAULT 1,
  erstellt_am      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_stil  (stil_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS starterpaket_bestellungen (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id          INT NOT NULL,
  paket_id         INT NOT NULL,
  mitglied_id      INT NOT NULL,
  gesamtpreis_cent INT NOT NULL DEFAULT 0,
  status           ENUM('offen','bezahlt','storniert') NOT NULL DEFAULT 'offen',
  varianten_json   JSON NULL,
  erstellt_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo    (dojo_id),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS starterpaket_positionen (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  paket_id         INT         NOT NULL,
  artikel_id       INT         NULL,
  bezeichnung      VARCHAR(200) NOT NULL,
  menge            INT         NOT NULL DEFAULT 1,
  einzelpreis_cent INT         NOT NULL DEFAULT 0,
  position         INT         NOT NULL DEFAULT 0,
  pflicht          TINYINT(1)  NOT NULL DEFAULT 1,
  INDEX idx_paket   (paket_id),
  INDEX idx_artikel (artikel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
