-- ============================================================
-- Migration 072: Kontoauszug-Import als Enterprise-Feature
-- ============================================================
-- Fügt feature_kontoauszug als eigene Enterprise-Spalte hinzu.
-- buchfuehrung (Kassenbuch, Belege) bleibt Premium.
-- kontoauszug (Bank-Import, Auto-Kategorisierung, EÜR-Auswertung) = Enterprise.
-- ============================================================

-- 1. Spalte in dojo_subscriptions
ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS feature_kontoauszug BOOLEAN DEFAULT FALSE
  COMMENT 'Enterprise: Bank-Import, Auto-Kategorisierung, EÜR/Bilanz-Auswertung';

-- 2. Spalte in subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS feature_kontoauszug BOOLEAN DEFAULT FALSE;

-- 3. Nur Enterprise bekommt kontoauszug
UPDATE subscription_plans
  SET feature_kontoauszug = TRUE
  WHERE plan_name = 'enterprise';

-- 4. Bestehende Enterprise-Subscriptions aktivieren
UPDATE dojo_subscriptions s
  JOIN subscription_plans p ON p.plan_name = s.plan_type
  SET s.feature_kontoauszug = p.feature_kontoauszug;

-- 5. bank_transaktionen: Neue Spalten für erweiterte Kategorisierung
--    (alte ENUM-Kategorie bleibt für Rückwärtskompatibilität)
ALTER TABLE bank_transaktionen
  ADD COLUMN IF NOT EXISTS auto_kategorie     VARCHAR(100) DEFAULT NULL
    COMMENT 'Freitext-Kategorie aus Auto-Kategorisierung',
  ADD COLUMN IF NOT EXISTS auto_kategorie_typ VARCHAR(20)  DEFAULT NULL
    COMMENT 'einnahme | ausgabe | transfer',
  ADD COLUMN IF NOT EXISTS auto_kategorie_euer VARCHAR(80) DEFAULT NULL
    COMMENT 'betriebseinnahme | betriebsausgabe | nicht_steuerrelevant';

-- import_format auf Excel/XLSX erweitern
ALTER TABLE bank_transaktionen
  MODIFY COLUMN import_format ENUM('csv','mt940','excel','ofx','qif') NOT NULL DEFAULT 'csv';

-- extern_ref_id in buchhaltung_belege (für Bank-Import-Herkunft)
ALTER TABLE buchhaltung_belege
  ADD COLUMN IF NOT EXISTS extern_ref_id INT DEFAULT NULL
    COMMENT 'transaktion_id aus bank_transaktionen bei Bank-Import-Belegen',
  ADD COLUMN IF NOT EXISTS quelle VARCHAR(50) DEFAULT NULL
    COMMENT 'manual | bank_import | auto';

-- 6. Kategorien-Tabelle für Bank-Transaktionen (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS bank_kategorien (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id       INT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  typ           ENUM('einnahme','ausgabe','transfer') NOT NULL DEFAULT 'ausgabe',
  euer_typ      VARCHAR(80) DEFAULT NULL
    COMMENT 'z.B. betriebsausgabe, betriebseinnahme, nicht_steuerrelevant',
  farbe         VARCHAR(7) DEFAULT '#6c757d',
  icon          VARCHAR(50) DEFAULT 'tag',
  sort_order    INT DEFAULT 0,
  erstellt_am   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dojo_kategorie (dojo_id, name),
  KEY idx_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Keyword-Regeln für Auto-Kategorisierung
CREATE TABLE IF NOT EXISTS bank_kategorie_regeln (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id       INT NOT NULL,
  kategorie_id  INT NOT NULL,
  keyword       VARCHAR(200) NOT NULL,
  feld          ENUM('verwendungszweck','auftraggeber','beides') DEFAULT 'beides',
  prioritaet    INT DEFAULT 10,
  KEY idx_dojo (dojo_id),
  KEY idx_kategorie (kategorie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. EÜR-Zuordnungen aus Bank-Transaktionen
CREATE TABLE IF NOT EXISTS bank_euer_zuordnungen (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL,
  transaktion_id    INT NOT NULL,
  euer_kategorie    VARCHAR(100) NOT NULL
    COMMENT 'betriebseinnahme, betriebsausgabe, werbungskosten, sonderausgaben etc.',
  euer_unterkategorie VARCHAR(100) DEFAULT NULL,
  betrag_eur        DECIMAL(10,2) NOT NULL,
  buchungsjahr      YEAR NOT NULL,
  notiz             TEXT DEFAULT NULL,
  erstellt_am       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_transaktion (transaktion_id),
  KEY idx_dojo_jahr (dojo_id, buchungsjahr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
