-- ============================================================================
-- 191: Pilot-Partner Feedback-System
-- Zeitgesteuerte Fragebögen für gewonnene Pilot-Partner:
--   Tag 14: "Wie war die Einrichtung?"  ·  Tag 28: "Erste Erfahrungen"
--   danach alle 28 Tage: "Wie läuft's?" (bis Programm-Ende nach 12 Monaten)
-- Versand per E-Mail mit Token-Link → dojo.tda-intl.org/pilot-feedback/:token
-- ============================================================================

ALTER TABLE pilot_bewerbungen
  ADD COLUMN programm_start DATE DEFAULT NULL AFTER status;

CREATE TABLE IF NOT EXISTS pilot_feedback_umfragen (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  bewerbung_id   INT NOT NULL,
  typ            ENUM('einrichtung','erfahrung','laufend') NOT NULL,
  runde          INT NOT NULL DEFAULT 1,
  faellig_am     DATE NOT NULL,
  token          VARCHAR(64) NOT NULL,
  gesendet_am    DATETIME DEFAULT NULL,
  erinnert_am    DATETIME DEFAULT NULL,
  beantwortet_am DATETIME DEFAULT NULL,
  antworten      LONGTEXT DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_token (token),
  UNIQUE KEY uq_bewerbung_typ_runde (bewerbung_id, typ, runde),
  INDEX idx_faellig (faellig_am),
  INDEX idx_bewerbung (bewerbung_id),
  CONSTRAINT fk_pfu_bewerbung FOREIGN KEY (bewerbung_id)
    REFERENCES pilot_bewerbungen(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
