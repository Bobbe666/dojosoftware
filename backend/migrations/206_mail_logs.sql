-- 206: Rechtssicheres Mail-Archiv (Dojo-Mitglieder + Verband)
-- Jede gesendete E-Mail wird gespeichert und dem Kunden/Mitglied zugeordnet.

CREATE TABLE IF NOT EXISTS mitglied_mail_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id  INT NULL,
  dojo_id      INT NULL,
  empfaenger   VARCHAR(255) NULL,
  typ          VARCHAR(64) NULL,
  betreff      VARCHAR(512) NULL,
  html         MEDIUMTEXT NULL,
  text_inhalt  MEDIUMTEXT NULL,
  status       VARCHAR(32) NOT NULL DEFAULT 'gesendet',
  gesendet_am  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mml_mitglied (mitglied_id),
  INDEX idx_mml_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verband_mail_log (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  mitgliedschaft_id INT NULL,
  empfaenger        VARCHAR(255) NULL,
  typ               VARCHAR(64) NULL,
  betreff           VARCHAR(512) NULL,
  html              MEDIUMTEXT NULL,
  text_inhalt       MEDIUMTEXT NULL,
  message_id        VARCHAR(255) NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'gesendet',
  gesendet_am       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vml_mitgliedschaft (mitgliedschaft_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
