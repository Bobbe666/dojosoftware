-- Migration 100: Mahnwesen, Wiederkehrende Buchungen, GWG, Privatanteil, Kreditoren
-- ================================================================================

-- 1. buchhaltung_belege — neue Spalten für GWG-Flag und Privatanteil
-- Spalte ist_gwg hinzufügen (ignoriert Fehler wenn schon existiert)
ALTER TABLE buchhaltung_belege ADD COLUMN ist_gwg TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE buchhaltung_belege ADD COLUMN privatanteil_prozent DECIMAL(5,2) NOT NULL DEFAULT 0.00;

-- 2. Kreditoren / Lieferantenakte
CREATE TABLE IF NOT EXISTS kreditoren (
  kreditor_id       INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL,
  organisation_name VARCHAR(100) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  kurzname          VARCHAR(50),
  adresse           TEXT,
  email             VARCHAR(255),
  telefon           VARCHAR(50),
  ust_id            VARCHAR(30),
  zahlungsziel_tage INT NOT NULL DEFAULT 14,
  iban              VARCHAR(34),
  bic               VARCHAR(11),
  notizen           TEXT,
  aktiv             TINYINT(1) NOT NULL DEFAULT 1,
  erstellt_am       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Mahnwesen
CREATE TABLE IF NOT EXISTS mahnungen (
  mahnung_id        INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL,
  organisation_name VARCHAR(100) NOT NULL,
  beleg_id          INT NULL,
  rechnung_id       INT NULL,
  mitglied_id       INT NULL,
  schuldner_name    VARCHAR(255) NOT NULL,
  offener_betrag    DECIMAL(12,2) NOT NULL,
  faelligkeitsdatum DATE NOT NULL,
  mahnstufe         TINYINT NOT NULL DEFAULT 1 COMMENT '1=Erinnerung, 2=1.Mahnung, 3=2.Mahnung',
  mahngebuehr       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  mahntext          TEXT,
  versandt_am       DATE NULL,
  versandt_per      VARCHAR(50),
  bezahlt_am        DATE NULL,
  storniert         TINYINT(1) NOT NULL DEFAULT 0,
  erstellt_von      INT,
  erstellt_am       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo    (dojo_id),
  INDEX idx_status  (dojo_id, bezahlt_am, storniert)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Wiederkehrende Buchungen (Templates)
CREATE TABLE IF NOT EXISTS wiederkehrende_buchungen (
  template_id         INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id             INT NOT NULL,
  organisation_name   VARCHAR(100) NOT NULL,
  bezeichnung         VARCHAR(255) NOT NULL,
  buchungsart         ENUM('einnahme','ausgabe') NOT NULL DEFAULT 'ausgabe',
  betrag_netto        DECIMAL(12,2) NOT NULL,
  mwst_satz           DECIMAL(5,2) NOT NULL DEFAULT 19.00,
  kategorie           VARCHAR(100) NOT NULL,
  beschreibung        TEXT,
  lieferant_kunde     VARCHAR(255),
  intervall           ENUM('wöchentlich','monatlich','vierteljährlich','halbjährlich','jährlich') NOT NULL DEFAULT 'monatlich',
  naechste_faelligkeit DATE NOT NULL,
  letzte_ausfuehrung  DATE NULL,
  aktiv               TINYINT(1) NOT NULL DEFAULT 1,
  auto_ausfuehren     TINYINT(1) NOT NULL DEFAULT 0,
  erstellt_von        INT,
  erstellt_am         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  geaendert_am        TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo      (dojo_id),
  INDEX idx_faelligkeit (dojo_id, naechste_faelligkeit, aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. v_euer_ausgaben aktualisieren: Privatanteil im Beleg-Branch abziehen
CREATE OR REPLACE VIEW v_euer_ausgaben AS

SELECT 'Beleg' AS quelle,
       b.beleg_id AS referenz_id,
       b.dojo_id,
       b.organisation_name,
       b.beleg_datum AS datum,
       ROUND(b.betrag_brutto * (1 - COALESCE(b.privatanteil_prozent, 0) / 100), 2) AS betrag_brutto,
       b.kategorie,
       b.beschreibung,
       YEAR(b.beleg_datum) AS jahr,
       MONTH(b.beleg_datum) AS monat
FROM buchhaltung_belege b
WHERE b.buchungsart = 'ausgabe'
  AND b.storniert = 0
  AND b.kategorie NOT IN ('privateinlage', 'privatentnahme', 'anlagevermögen')

UNION ALL

SELECT 'Bank' AS quelle,
       bt.transaktion_id AS referenz_id,
       bt.dojo_id,
       bt.organisation_name,
       bt.buchungsdatum AS datum,
       ABS(bt.betrag) AS betrag_brutto,
       COALESCE(bt.kategorie, 'sonstige_kosten') AS kategorie,
       CONCAT(bt.auftraggeber_empfaenger, ': ', COALESCE(bt.verwendungszweck, '')) AS beschreibung,
       YEAR(bt.buchungsdatum) AS jahr,
       MONTH(bt.buchungsdatum) AS monat
FROM bank_transaktionen bt
WHERE bt.betrag < 0
  AND bt.status = 'zugeordnet'
  AND bt.kategorie NOT IN ('privateinlage', 'privatentnahme')
  AND bt.beleg_id IS NULL

UNION ALL

SELECT 'Kasse' AS quelle,
       k.eintrag_id AS referenz_id,
       COALESCE(k.dojo_id, 1) AS dojo_id,
       CASE WHEN k.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
       k.geschaeft_datum AS datum,
       k.betrag_cent / 100 AS betrag_brutto,
       'sonstige_kosten' AS kategorie,
       k.beschreibung,
       YEAR(k.geschaeft_datum) AS jahr,
       MONTH(k.geschaeft_datum) AS monat
FROM kassenbuch k
WHERE k.bewegungsart = 'ausgabe'

UNION ALL

SELECT 'AfA' AS quelle,
       ap.afa_id AS referenz_id,
       ap.dojo_id,
       ap.organisation_name,
       MAKEDATE(ap.afa_jahr, 1) AS datum,
       ap.afa_betrag AS betrag_brutto,
       'abschreibungen' AS kategorie,
       CONCAT('AfA: ', ar.bezeichnung, ' (', ap.afa_jahr, ')') AS beschreibung,
       ap.afa_jahr AS jahr,
       1 AS monat
FROM afa_positionen ap
JOIN anlage_register ar ON ar.anlage_id = ap.anlage_id
WHERE ap.afa_jahr <= YEAR(CURDATE())
  AND ar.aktiv = 1;
