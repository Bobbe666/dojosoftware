-- =============================================================================
-- Migration 234: Vertretung — Mehrfach-Zusage pro Anfrage (Coach-App)
-- Kundenwunsch: Pro Anfrage soll wählbar sein, ob NUR EIN Trainer zusagen kann
-- (first-come, wie bisher) ODER MEHRERE Trainer für dieselbe Stunde zusagen dürfen.
--
-- Additiv/rückwärtskompatibel:
--   * zusage_modus steuert das Verhalten pro Anfrage (Default 'einzel' = altes Verhalten).
--   * vertretungs_zusagen speichert EINZELNE Zusagen (auch im einzel-Modus die eine
--     Gewinner-Zusage) → einheitliche Grundlage für „Meine übernommenen Vertretungen".
-- =============================================================================

-- 1) Modus pro Anfrage
ALTER TABLE vertretungs_anfragen
  ADD COLUMN zusage_modus ENUM('einzel','mehrfach') NOT NULL DEFAULT 'einzel'
    COMMENT 'einzel = first-come (eine Zusage schließt die Anfrage); mehrfach = mehrere Trainer können zusagen'
    AFTER status;

-- 2) Einzelne Zusagen (n:1 zur Anfrage)
CREATE TABLE IF NOT EXISTS vertretungs_zusagen (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  anfrage_id    INT NOT NULL,
  dojo_id       INT NOT NULL,
  admin_id      INT NOT NULL,               -- zusagender Trainer (admin_users.id)
  name          VARCHAR(150) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_anfrage_admin (anfrage_id, admin_id),  -- kein Trainer sagt doppelt zu
  INDEX idx_anfrage (anfrage_id),
  INDEX idx_dojo_admin (dojo_id, admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Einzelne Trainer-Zusagen zu Vertretungs-Anfragen (Mehrfach-Modus)';

-- 3) Bestandsdaten backfilllen: bereits übernommene Anfragen (einzel) als Zusage abbilden,
--    damit sie in „Meine übernommenen Vertretungen" auftauchen.
INSERT IGNORE INTO vertretungs_zusagen (anfrage_id, dojo_id, admin_id, name, created_at)
SELECT id, dojo_id, uebernommen_admin_id, uebernommen_name, COALESCE(uebernommen_am, created_at)
  FROM vertretungs_anfragen
 WHERE status = 'uebernommen' AND uebernommen_admin_id IS NOT NULL;
