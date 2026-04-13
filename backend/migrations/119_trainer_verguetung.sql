-- Migration 119: Vergütungsfelder für Trainer
-- Trainer-Tabelle bekommt Stundenlohn + Beschäftigungsart für Gehaltsabrechnung

ALTER TABLE trainer
  ADD COLUMN IF NOT EXISTS stundenlohn        DECIMAL(6,2)  DEFAULT NULL COMMENT 'Stundenlohn in EUR (Freelancer/Honorar)',
  ADD COLUMN IF NOT EXISTS grundverguetung    DECIMAL(10,2) DEFAULT NULL COMMENT 'Monatliche Grundvergütung in EUR',
  ADD COLUMN IF NOT EXISTS beschaeftigungsart ENUM('Freelancer','Honorar','Angestellt','Minijob','Ehrenamt') DEFAULT 'Freelancer',
  ADD COLUMN IF NOT EXISTS iban               VARCHAR(34)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bic                VARCHAR(11)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS steuerklasse       TINYINT       DEFAULT NULL;
