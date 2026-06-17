-- 208: Automatische AG-Abrechnung (z. B. Karate AG an Schulen)
-- Variante A: Unterrichtstage = fester Wochentag minus Schulferien (Bayern)
-- Variante B: Monatsend-Entwurf zur Bestätigung, bevor die Rechnung erzeugt/versendet wird

CREATE TABLE IF NOT EXISTS ag_abrechnung_config (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id          INT NOT NULL,
  mitglied_id      INT NULL,                       -- Rechnungsempfänger (Schule)
  bezeichnung      VARCHAR(255) NOT NULL DEFAULT 'Karatestunden AG',
  artikelnummer    VARCHAR(100) NULL,
  wochentag        TINYINT NOT NULL DEFAULT 2,     -- ISO: 1=Mo … 7=So (Dienstag=2)
  stunden_pro_tag  DECIMAL(5,2) NOT NULL DEFAULT 3.00,
  preis_pro_stunde DECIMAL(10,2) NOT NULL DEFAULT 30.67,
  mwst_satz        DECIMAL(5,2) NOT NULL DEFAULT 19.00,
  bundesland       VARCHAR(5) NOT NULL DEFAULT 'BY',
  empfaenger_email VARCHAR(255) NULL,
  auto_versand     TINYINT(1) NOT NULL DEFAULT 0,  -- 0 = erst nach Bestätigung (Variante B)
  aktiv            TINYINT(1) NOT NULL DEFAULT 1,
  gueltig_ab       DATE NULL,
  gueltig_bis      DATE NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ag_dojo (dojo_id),
  INDEX idx_ag_aktiv (aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ag_abrechnung_lauf (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  config_id     INT NOT NULL,
  jahr          INT NOT NULL,
  monat         TINYINT NOT NULL,
  status        ENUM('entwurf','bestaetigt','berechnet','versendet','storniert') NOT NULL DEFAULT 'entwurf',
  tage          JSON NULL,                         -- bestätigte/berechnete Unterrichtstage (YYYY-MM-DD[])
  anzahl_tage   INT NOT NULL DEFAULT 0,
  rechnung_id   INT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bestaetigt_am DATETIME NULL,
  UNIQUE KEY uniq_lauf (config_id, jahr, monat),
  INDEX idx_lauf_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schulferien (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  bundesland  VARCHAR(5) NOT NULL DEFAULT 'BY',
  name        VARCHAR(100) NOT NULL,
  von         DATE NOT NULL,
  bis         DATE NOT NULL,
  INDEX idx_ferien_land (bundesland),
  INDEX idx_ferien_von (von)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bayerische Schulferien (Quelle: schulferien.org) – unterrichtsfreie Zeiträume
INSERT INTO schulferien (bundesland, name, von, bis) VALUES
('BY','Sommerferien 2025','2025-08-01','2025-09-15'),
('BY','Herbstferien 2025','2025-11-03','2025-11-07'),
('BY','Buß- und Bettag 2025','2025-11-19','2025-11-19'),
('BY','Weihnachtsferien 2025/26','2025-12-22','2026-01-05'),
('BY','Frühjahrsferien 2026','2026-02-16','2026-02-20'),
('BY','Osterferien 2026','2026-03-30','2026-04-10'),
('BY','Pfingstferien 2026','2026-05-26','2026-06-05'),
('BY','Sommerferien 2026','2026-08-03','2026-09-14'),
('BY','Herbstferien 2026','2026-11-02','2026-11-06'),
('BY','Buß- und Bettag 2026','2026-11-18','2026-11-18'),
('BY','Weihnachtsferien 2026/27','2026-12-24','2027-01-08');
