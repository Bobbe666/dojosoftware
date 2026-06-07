-- ============================================================================
-- 190: Pilot-Partner-Programm — Bewerbungen
-- Öffentliches Bewerbungsformular auf tda-intl.com (/pilot-partner)
-- Verwaltung durch Super-Admin in der PlattformZentrale
-- ============================================================================

CREATE TABLE IF NOT EXISTS pilot_bewerbungen (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  schulname         VARCHAR(255) NOT NULL,
  ansprechpartner   VARCHAR(255) NOT NULL,
  email             VARCHAR(255) NOT NULL,
  telefon           VARCHAR(50)  DEFAULT NULL,
  ort               VARCHAR(255) DEFAULT NULL,
  website           VARCHAR(255) DEFAULT NULL,
  stilrichtungen    VARCHAR(500) DEFAULT NULL,
  mitglieder_anzahl VARCHAR(50)  DEFAULT NULL,
  aktuelle_software VARCHAR(255) DEFAULT NULL,
  herausforderung   TEXT,
  begruendung       TEXT,
  status            ENUM('neu','in_pruefung','gewonnen','abgelehnt') NOT NULL DEFAULT 'neu',
  notiz_intern      TEXT,
  ip_adresse        VARCHAR(64)  DEFAULT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
