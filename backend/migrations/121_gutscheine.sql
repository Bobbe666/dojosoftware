-- Migration 121: Gutschein-System (Premium Feature)
-- Vorlagen (Bilder/Anlässe) und generierte Gutschein-Codes pro Dojo

-- Feature-Flag in dojo_subscriptions ergänzen
ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS feature_gutscheine TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Premium: Gutschein-Generator mit Homepage-Einbettung';

-- Gutschein-Vorlagen (zentral, Super-Admin pflegt Bilder)
CREATE TABLE IF NOT EXISTS gutschein_vorlagen (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  anlass        ENUM('weihnachten','geburtstag','kinder','erwachsene','allgemein') NOT NULL,
  titel         VARCHAR(100) NOT NULL,
  bild_pfad     VARCHAR(255) NOT NULL        COMMENT 'Relativer Pfad unter /uploads/gutschein-vorlagen/',
  bild_url      VARCHAR(500) NULL            COMMENT 'Vollständige öffentliche URL (wird beim Anlegen gesetzt)',
  sort_order    INT NOT NULL DEFAULT 0,
  aktiv         TINYINT(1) NOT NULL DEFAULT 1,
  erstellt_am   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_anlass (anlass),
  INDEX idx_aktiv (aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Generierte Gutscheine pro Dojo
CREATE TABLE IF NOT EXISTS gutscheine (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id          INT NOT NULL,
  vorlage_id       INT NOT NULL,
  code             VARCHAR(20) NOT NULL UNIQUE     COMMENT 'Öffentlicher Gutschein-Code (z.B. GS-XKTZ9)',
  wert             DECIMAL(8,2) NOT NULL            COMMENT 'Gutscheinwert in EUR',
  titel            VARCHAR(150) NOT NULL,
  nachricht        TEXT NULL                         COMMENT 'Persönliche Nachricht auf dem Gutschein',
  gueltig_bis      DATE NULL,
  eingeloest       TINYINT(1) NOT NULL DEFAULT 0,
  eingeloest_am    DATE NULL,
  empfaenger_name  VARCHAR(150) NULL,
  empfaenger_email VARCHAR(200) NULL,

  -- Zahlungsfelder (für Online-Kauf über Shop)
  kaeufer_name     VARCHAR(150) NULL               COMMENT 'Name des Käufers (wenn online gekauft)',
  kaeufer_email    VARCHAR(200) NULL               COMMENT 'E-Mail des Käufers',
  bezahlt          TINYINT(1) NOT NULL DEFAULT 0   COMMENT '0=ausstehend/intern, 1=bezahlt',
  bezahlt_am       DATETIME NULL,
  zahlungsart      ENUM('intern','paypal','stripe') NOT NULL DEFAULT 'intern',
  payment_id       VARCHAR(200) NULL               COMMENT 'PayPal/Stripe Payment-ID für Nachverfolgung',
  preis_bezahlt    DECIMAL(8,2) NULL               COMMENT 'Tatsächlich bezahlter Preis (falls rabattiert)',
  pdf_pfad         VARCHAR(500) NULL               COMMENT 'Pfad zur generierten PDF-Datei',
  pdf_token        VARCHAR(64) NULL UNIQUE          COMMENT 'Sicherer Download-Token für PDF',

  erstellt_von     INT NULL                         COMMENT 'user_id (wenn intern erstellt)',
  erstellt_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  geaendert_am     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (dojo_id)    REFERENCES dojo(id) ON DELETE CASCADE,
  FOREIGN KEY (vorlage_id) REFERENCES gutschein_vorlagen(id),
  INDEX idx_dojo (dojo_id),
  INDEX idx_code (code),
  INDEX idx_eingeloest (eingeloest),
  INDEX idx_bezahlt (bezahlt),
  INDEX idx_pdf_token (pdf_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
