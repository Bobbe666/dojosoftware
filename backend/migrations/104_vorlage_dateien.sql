CREATE TABLE IF NOT EXISTS vorlage_dateien (
  datei_id        INT           NOT NULL AUTO_INCREMENT,
  vorlage_id      INT           NOT NULL,
  dojo_id         INT           NOT NULL,
  original_name   VARCHAR(255)  NOT NULL,
  gespeicherter_name VARCHAR(255) NOT NULL,
  pfad            VARCHAR(500)  NOT NULL,
  mime_type       VARCHAR(100)  NOT NULL DEFAULT '',
  groesse_bytes   INT           NOT NULL DEFAULT 0,
  erstellt_am     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (datei_id),
  KEY idx_vorlage_dateien_vorlage (vorlage_id),
  KEY idx_vorlage_dateien_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
