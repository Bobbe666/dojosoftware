-- ============================================================================
-- 209: Verbands-Fremdtermine (Turniertermine anderer Kampfsportverbände)
-- Zweck: Überschneidungen beim Anlegen eigener Turniere/Events vermeiden.
-- Wird im Super-Admin-Kalender gepflegt + via Sync-Button (Claude Web-Suche)
-- befüllt. Bestätigte Termine fließen in den Konflikt-Check ein.
-- ============================================================================
CREATE TABLE IF NOT EXISTS verbands_fremdtermine (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  verband      VARCHAR(80)  NOT NULL,                       -- DKV, WKU, WAKO, Taekwondo, BKO, WMAC, WOMAA, sonstige
  titel        VARCHAR(255) NOT NULL,
  start_datum  DATE         NOT NULL,
  end_datum    DATE         NULL,
  ort          VARCHAR(255) NULL,
  region       VARCHAR(120) NULL,
  quelle_url   VARCHAR(500) NULL,
  notiz        TEXT         NULL,
  status       ENUM('bestaetigt','unbestaetigt') NOT NULL DEFAULT 'bestaetigt',
  quelle_typ   ENUM('manuell','sync')            NOT NULL DEFAULT 'manuell',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_start  (start_datum),
  INDEX idx_status (status),
  INDEX idx_verband (verband)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
