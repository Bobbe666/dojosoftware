-- =============================================================================
-- Migration 217: Vertretungs-Anfragen (Coach-App)
-- Trainer fragt alle Trainer „kann jemand übernehmen?"; erster der zusagt
-- bekommt die Vertretung (first-come). Anfragender + Admin werden informiert.
-- =============================================================================

CREATE TABLE IF NOT EXISTS vertretungs_anfragen (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id                  INT NOT NULL,

  -- Anfragender Trainer (admin_users.id)
  anfrage_admin_id         INT NOT NULL,
  anfrage_name             VARCHAR(150) NOT NULL,

  -- Bezug: konkrete Stunde aus „Meine Stunden" ODER freie Eingabe
  kurs_id                  INT NULL,
  kurs_name                VARCHAR(200) NULL,
  datum                    DATE NULL,
  zeit                     VARCHAR(60) NULL,
  notiz                    TEXT NULL,

  status                   ENUM('offen','uebernommen','storniert') NOT NULL DEFAULT 'offen',

  -- Übernahme (first-come)
  uebernommen_admin_id     INT NULL,
  uebernommen_name         VARCHAR(150) NULL,
  uebernommen_am           TIMESTAMP NULL,

  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_dojo_status (dojo_id, status),
  INDEX idx_anfrage (anfrage_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Vertretungs-Anfragen der Coach-App';
