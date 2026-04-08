-- ============================================================================
-- Migration 073: Demo-Termin Buchungssystem
-- Zeitfenster für Super-Admin freigeben + öffentliche Buchungen
-- ============================================================================

-- Verfügbare Zeitfenster (vom Super-Admin angelegt)
CREATE TABLE IF NOT EXISTS demo_termine_slots (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  slot_start       DATETIME NOT NULL,
  slot_end         DATETIME NOT NULL,
  duration_minutes INT      DEFAULT 60,
  is_available     TINYINT(1) DEFAULT 1 COMMENT '0 = gesperrt, 1 = buchbar',
  is_booked        TINYINT(1) DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slot_start (slot_start),
  INDEX idx_available  (is_available, is_booked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buchungen von Interessenten
CREATE TABLE IF NOT EXISTS demo_buchungen (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  slot_id            INT          NOT NULL,
  vorname            VARCHAR(100) NOT NULL,
  nachname           VARCHAR(100) NOT NULL,
  email              VARCHAR(255) NOT NULL,
  telefon            VARCHAR(50),
  vereinsname        VARCHAR(255),
  bundesland         VARCHAR(100),
  mitglieder_anzahl  VARCHAR(50),
  nachricht          TEXT,
  status             ENUM('ausstehend','bestaetigt','abgesagt') DEFAULT 'ausstehend',
  admin_notiz        TEXT,
  buchungs_token     VARCHAR(64) UNIQUE NOT NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES demo_termine_slots(id) ON DELETE RESTRICT,
  INDEX idx_status (status),
  INDEX idx_email  (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
