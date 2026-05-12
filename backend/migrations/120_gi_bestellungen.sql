CREATE TABLE IF NOT EXISTS gi_bestellungen (
  bestellung_id  INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id        INT          NOT NULL,
  vorlage_id     INT          NULL,
  lieferant_id   INT          NULL,
  lieferant_name VARCHAR(255) NULL,
  bestelldatum   VARCHAR(20)  NULL,
  lieferdatum    VARCHAR(20)  NULL,
  status         VARCHAR(50)  NOT NULL DEFAULT 'bestellt',
  formdata       MEDIUMTEXT   NULL,
  erstellt_am    DATETIME     NOT NULL DEFAULT NOW(),
  INDEX idx_dojo    (dojo_id),
  INDEX idx_vorlage (vorlage_id),
  INDEX idx_status  (status)
);
