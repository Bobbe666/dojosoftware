-- Migration 120: Lastschrift-Einverständnis
-- Speichert pro Mitglied, ob er dem automatischen Lastschrifteinzug bei Einkäufen zugestimmt hat.
-- Wird per E-Mail-Link abgefragt; Antwort landet hier mit Zeitstempel.

CREATE TABLE IF NOT EXISTS lastschrift_einverstaendnis (
  id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  mitglied_id     INT           NOT NULL,
  dojo_id         INT           NOT NULL,

  -- Aktueller Stand
  status          ENUM('ausstehend','zugestimmt','abgelehnt') NOT NULL DEFAULT 'ausstehend',

  -- E-Mail-Versand
  angefragt_am    DATETIME      DEFAULT NULL,
  erinnerung_am   DATETIME      DEFAULT NULL,
  email_versendet TINYINT(1)    NOT NULL DEFAULT 0,

  -- Token für den E-Mail-Link (SHA-256 Hex, 64 Zeichen)
  token           VARCHAR(64)   NOT NULL UNIQUE,
  token_ablauf    DATETIME      DEFAULT NULL,

  -- Antwort des Mitglieds
  beantwortet_am  DATETIME      DEFAULT NULL,
  kanal           ENUM('email','portal','admin') DEFAULT NULL COMMENT 'Wie wurde die Antwort gegeben?',
  ip_adresse      VARCHAR(45)   DEFAULT NULL,

  -- Admin-Notiz
  notiz           TEXT          DEFAULT NULL,

  erstellt_am     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  INDEX idx_dojo      (dojo_id),
  INDEX idx_status    (status),
  INDEX idx_token     (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
