-- =============================================================================
-- Migration 220: Check-in-Einstellungen pro Dojo
-- Stil-Filter beim Check-in: zeigt Mitgliedern standardmäßig nur Kurse des
-- eigenen Stils (mit „Weitere"-Button für den Rest). Pro Dojo (Subdomain) wählbar.
-- =============================================================================
CREATE TABLE IF NOT EXISTS checkin_einstellungen (
  dojo_id           INT PRIMARY KEY,
  stil_filter_aktiv TINYINT(1) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Check-in-Einstellungen pro Dojo (Stil-Filter)';
