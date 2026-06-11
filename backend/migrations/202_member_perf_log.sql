-- Migration 202: Member-App-Telemetrie (Ladezeit + Gerät + Netzqualität pro App-Start)
-- Diagnose für „bei manchen Mitgliedern/Geräten langsam".

CREATE TABLE IF NOT EXISTS member_perf_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id     INT          NULL,
  dojo_id         INT          NULL,
  load_ms         INT          NULL COMMENT 'ms vom Navigationsstart bis memberData geladen',
  ttfb_ms         INT          NULL,
  dom_ms          INT          NULL,
  conn_type       VARCHAR(20)  NULL COMMENT 'effectiveType: 4g/3g/2g/slow-2g',
  downlink        FLOAT        NULL COMMENT 'Mbit/s (Schätzung Browser)',
  rtt             INT          NULL,
  device_memory   FLOAT        NULL COMMENT 'GB (Browser-Schätzung)',
  hw_concurrency  INT          NULL,
  viewport        VARCHAR(20)  NULL,
  user_agent      VARCHAR(300) NULL,
  fehler          VARCHAR(500) NULL,
  erstellt_am     DATETIME     NOT NULL DEFAULT NOW(),
  INDEX idx_perf_created (erstellt_am),
  INDEX idx_perf_mid (mitglied_id)
) COLLATE utf8mb4_unicode_ci;
