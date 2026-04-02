-- Migration 112: Brief-Einstellungen (DIN 5008, Schrift, Fußzeile)
-- Speichert pro Dojo die Einstellungen für Briefvorlagen und PDF-Generierung

CREATE TABLE IF NOT EXISTS brief_einstellungen (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id             INT NOT NULL,
  din_format          ENUM('din5008a','din5008b','custom') NOT NULL DEFAULT 'din5008a',
  margin_top_mm       DECIMAL(5,2) NOT NULL DEFAULT 27.00,
  margin_bottom_mm    DECIMAL(5,2) NOT NULL DEFAULT 26.46,
  margin_left_mm      DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  margin_right_mm     DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  font_family         VARCHAR(100) NOT NULL DEFAULT 'Helvetica',
  font_size_pt        DECIMAL(4,1) NOT NULL DEFAULT 10.0,
  line_height         DECIMAL(4,2) NOT NULL DEFAULT 1.60,
  footer_show_bank    TINYINT(1)   NOT NULL DEFAULT 1,
  footer_show_contact TINYINT(1)   NOT NULL DEFAULT 1,
  footer_show_inhaber TINYINT(1)   NOT NULL DEFAULT 1,
  footer_custom_html  TEXT         NULL,
  standard_profil_id  INT          NULL,
  erstellt_am         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
