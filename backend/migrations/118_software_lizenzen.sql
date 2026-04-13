-- Migration 118: Software-Lizenz-Einnahmen (Dojo-Abos) für TDA-EÜR
-- Wird in euer.js Route /tda unter "Software-Einnahmen" ausgelesen

CREATE TABLE IF NOT EXISTS software_lizenzen (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id       INT           NOT NULL,
  plan          VARCHAR(50)   NOT NULL DEFAULT 'standard',
  betrag        DECIMAL(10,2) NOT NULL,
  bezahlt_am    DATE          NOT NULL,
  periode_von   DATE          NULL,
  periode_bis   DATE          NULL,
  status        ENUM('bezahlt','offen','storniert') NOT NULL DEFAULT 'bezahlt',
  notiz         TEXT          NULL,
  erstellt_am   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
  INDEX idx_bezahlt_am (bezahlt_am),
  INDEX idx_dojo_status (dojo_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
