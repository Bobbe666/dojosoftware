-- Migration 183: Design-/Theme-Einstellungen pro Dojo (White-Label)
-- Ein Datensatz pro Dojo (dojo_id = PRIMARY KEY → Upsert via ON DUPLICATE KEY).
CREATE TABLE IF NOT EXISTS dojo_theme (
  dojo_id          INT NOT NULL PRIMARY KEY,
  theme_config     JSON NULL,
  erstellt_am      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dojo_theme_dojo FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
