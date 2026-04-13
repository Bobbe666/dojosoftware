-- Migration 073: Trainer-Erweiterung für Personal-Verwaltung + Dokumente

-- ─── 1. Trainer-Tabelle erweitern ────────────────────────────────────────────
ALTER TABLE trainer
  ADD COLUMN anschrift        VARCHAR(255)                                       DEFAULT NULL,
  ADD COLUMN geburtsdatum     DATE                                               DEFAULT NULL,
  ADD COLUMN graduierung      VARCHAR(50)                                        DEFAULT NULL,
  ADD COLUMN steuer_id        VARCHAR(50)                                        DEFAULT NULL,
  ADD COLUMN einstellungsdatum DATE                                              DEFAULT NULL,
  ADD COLUMN status           ENUM('aktiv','inaktiv','pausiert')                 DEFAULT 'aktiv',
  ADD COLUMN notizen          TEXT                                               DEFAULT NULL;

-- ─── 2. Trainer-Dokumente Tabelle ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainer_dokumente (
  id                          INT AUTO_INCREMENT PRIMARY KEY,
  trainer_id                  INT           NOT NULL,
  dojo_id                     INT           NOT NULL,
  dokument_typ                ENUM('vereinbarung','infoblatt') NOT NULL,
  status                      ENUM('erstellt','versendet','unterschrieben') DEFAULT 'erstellt',
  pdf_dateiname               VARCHAR(500)  DEFAULT NULL,
  mitgliedsbeitrag_monatlich  DECIMAL(10,2) DEFAULT NULL,
  sachleistungen_jahreswert   DECIMAL(10,2) DEFAULT NULL,
  vertragsbeginn              DATE          DEFAULT NULL,
  wettbewerb_radius           INT           DEFAULT 10,
  notiz                       TEXT          DEFAULT NULL,
  erstellt_am                 DATETIME      DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am             DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_trainer_id  (trainer_id),
  INDEX idx_dojo_id     (dojo_id)
);
