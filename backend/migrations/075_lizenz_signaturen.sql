-- ============================================================================
-- 075 — Lizenzvertrag Signaturen (elektronische Unterschriften + IP-Logging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lizenz_signaturen (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id       INT,
  plan          VARCHAR(50),
  interval_type VARCHAR(20),
  signed_at     DATETIME NOT NULL DEFAULT NOW(),
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  signed_by     VARCHAR(255),   -- Name des Unterzeichners
  pdf_filename  VARCHAR(255),
  INDEX idx_dojo (dojo_id),
  INDEX idx_signed_at (signed_at)
);
