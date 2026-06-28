-- =============================================================================
-- Migration 219: Urkunden-Vorlagen pro Dojo (White-Label)
-- Jedes Dojo kann eigene Urkunden hinterlegen: Hintergrund-Design + frei
-- positionierte Datenfelder (visueller Editor). Druck/Vorschau lesen daraus.
-- =============================================================================

CREATE TABLE IF NOT EXISTS urkunden_vorlagen (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id       INT NOT NULL,
  name          VARCHAR(150) NOT NULL,
  stil_id       INT NULL,                       -- optional an einen Stil gebunden

  seitenformat  ENUM('a4_hoch','a4_quer') NOT NULL DEFAULT 'a4_quer',
  bg_image_path VARCHAR(300) NULL,              -- hochgeladenes Design (Vorschau-Hintergrund)

  -- Felder als JSON: [{ key, label?, top, left, width, align, size, bold, italic, text? }]
  -- key ∈ name | grad | datum | ort | nummer | pruefer1 | pruefer2 | freitext
  felder        JSON NOT NULL,

  schriftart    VARCHAR(120) NOT NULL DEFAULT 'Georgia, serif',
  extra_font_url VARCHAR(300) NULL,             -- optionale Web-Schrift (z.B. Google Fonts)

  -- Optionen: { gradKyuOnly:bool, datumLang:bool, nummerPrefix:string }
  optionen      JSON NULL,

  aktiv         TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_dojo (dojo_id),
  INDEX idx_dojo_aktiv (dojo_id, aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Urkunden-Druckvorlagen pro Dojo (visueller Editor)';

-- Enterprise-Feature-Gate (eigene Urkunden-Designs)
ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS feature_urkunden_vorlagen TINYINT(1) NOT NULL DEFAULT 0;

-- Für alle Enterprise-Dojos freischalten (Enterprise = feature_messenger) + KSS (Dojo 3)
UPDATE dojo_subscriptions SET feature_urkunden_vorlagen = 1 WHERE feature_messenger = 1;
UPDATE dojo_subscriptions SET feature_urkunden_vorlagen = 1 WHERE dojo_id = 3;
