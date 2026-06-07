-- ============================================================================
-- 194: Cron-Lauf-Protokoll
-- Hält pro Job den letzten Lauf fest (Zeitpunkt, Erfolg, Kurzinfo) — damit im
-- System-Tab sichtbar ist, ob die geplanten Jobs (Briefing, Feedback, …) laufen.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cron_runs (
  job_key      VARCHAR(80) NOT NULL PRIMARY KEY,
  letzter_lauf DATETIME DEFAULT NULL,
  erfolg       TINYINT(1) DEFAULT 1,
  info         VARCHAR(500) DEFAULT NULL,
  dauer_ms     INT DEFAULT NULL,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
