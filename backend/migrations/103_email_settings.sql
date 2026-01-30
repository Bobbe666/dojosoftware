-- Migration 103: E-Mail-Einstellungen
-- Globale E-Mail-Konfiguration und Dojo-spezifische SMTP-Einstellungen

-- Globale E-Mail-Einstellungen (für zentralen Versand)
CREATE TABLE IF NOT EXISTS email_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,

  -- Zentraler SMTP-Server (Fallback für alle Dojos)
  smtp_host VARCHAR(255) NOT NULL DEFAULT '',
  smtp_port INT NOT NULL DEFAULT 587,
  smtp_secure TINYINT(1) NOT NULL DEFAULT 1,  -- 1 = TLS, 0 = keine Verschlüsselung
  smtp_user VARCHAR(255) NOT NULL DEFAULT '',
  smtp_password VARCHAR(255) NOT NULL DEFAULT '',

  -- Absender-Einstellungen
  default_from_email VARCHAR(255) NOT NULL DEFAULT 'noreply@tda-intl.com',
  default_from_name VARCHAR(255) NOT NULL DEFAULT 'DojoSoftware',

  -- Status
  aktiv TINYINT(1) NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialen Datensatz einfügen (falls nicht vorhanden)
INSERT INTO email_settings (id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, default_from_email, default_from_name, aktiv)
SELECT 1, '', 587, 1, '', '', 'noreply@tda-intl.com', 'DojoSoftware', 1
WHERE NOT EXISTS (SELECT 1 FROM email_settings WHERE id = 1);

-- Dojo-spezifische SMTP-Einstellungen
ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS email_mode ENUM('zentral', 'eigener_smtp', 'tda_email') DEFAULT 'zentral' AFTER email,
ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255) NULL AFTER email_mode,
ADD COLUMN IF NOT EXISTS smtp_port INT NULL DEFAULT 587 AFTER smtp_host,
ADD COLUMN IF NOT EXISTS smtp_secure TINYINT(1) NULL DEFAULT 1 AFTER smtp_port,
ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255) NULL AFTER smtp_secure,
ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(255) NULL AFTER smtp_user,
ADD COLUMN IF NOT EXISTS tda_email VARCHAR(255) NULL AFTER smtp_password,
ADD COLUMN IF NOT EXISTS tda_email_password VARCHAR(255) NULL AFTER tda_email;

-- Index für schnellere Abfragen
ALTER TABLE dojo ADD INDEX IF NOT EXISTS idx_email_mode (email_mode);
