-- Migration 099: Anlagevermögen-Register & AfA (Lineare Abschreibung § 7 EStG)
-- =============================================================================

-- 1. Asset Register
CREATE TABLE IF NOT EXISTS anlage_register (
    anlage_id            INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id              INT NOT NULL,
    organisation_name    VARCHAR(100) NOT NULL,
    bezeichnung          VARCHAR(255) NOT NULL,
    beschreibung         TEXT,
    anlage_kategorie     VARCHAR(50) NOT NULL DEFAULT 'sonstiges',
    kaufdatum            DATE NOT NULL,
    anschaffungskosten   DECIMAL(12,2) NOT NULL,
    restwert             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    nutzungsdauer        INT NOT NULL,
    lieferant            VARCHAR(255),
    rechnungsnummer      VARCHAR(100),
    beleg_id             INT NULL,
    aktiv                TINYINT(1) NOT NULL DEFAULT 1,
    ausgeschieden_am     DATE NULL,
    ausscheidungsgrund   VARCHAR(255),
    erstellt_von         INT,
    erstellt_am          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geaendert_von        INT NULL,
    geaendert_am         TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dojo       (dojo_id),
    INDEX idx_aktiv      (dojo_id, aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Pre-computed AfA per asset per year
CREATE TABLE IF NOT EXISTS afa_positionen (
    afa_id               INT AUTO_INCREMENT PRIMARY KEY,
    anlage_id            INT NOT NULL,
    dojo_id              INT NOT NULL,
    organisation_name    VARCHAR(100) NOT NULL,
    afa_jahr             INT NOT NULL,
    afa_betrag           DECIMAL(12,2) NOT NULL,
    buchwert_beginn      DECIMAL(12,2) NOT NULL,
    buchwert_ende        DECIMAL(12,2) NOT NULL,
    ist_erstes_jahr      TINYINT(1) NOT NULL DEFAULT 0,
    ist_letztes_jahr     TINYINT(1) NOT NULL DEFAULT 0,
    erstellt_am          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_anlage_jahr (anlage_id, afa_jahr),
    INDEX idx_dojo_jahr  (dojo_id, afa_jahr),
    FOREIGN KEY (anlage_id) REFERENCES anlage_register(anlage_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Update v_euer_ausgaben:
--    - Beleg-Branch: 'anlagevermögen'-Belege ausschliessen (nur Kassenbuch-Tracking, keine direkte EÜR-Ausgabe)
--    - Bank-Branch:  unveraendert (von vorheriger manueller Anpassung)
--    - Kasse-Branch: unveraendert
--    - AfA-Branch:   neu hinzugefuegt aus afa_positionen (aktuelle + vergangene Jahre)

CREATE OR REPLACE VIEW v_euer_ausgaben AS

SELECT 'Beleg' AS quelle,
       buchhaltung_belege.beleg_id AS referenz_id,
       buchhaltung_belege.dojo_id AS dojo_id,
       buchhaltung_belege.organisation_name AS organisation_name,
       buchhaltung_belege.beleg_datum AS datum,
       buchhaltung_belege.betrag_brutto AS betrag_brutto,
       buchhaltung_belege.kategorie AS kategorie,
       buchhaltung_belege.beschreibung AS beschreibung,
       YEAR(buchhaltung_belege.beleg_datum) AS jahr,
       MONTH(buchhaltung_belege.beleg_datum) AS monat
FROM buchhaltung_belege
WHERE buchhaltung_belege.buchungsart = 'ausgabe'
  AND buchhaltung_belege.storniert = 0
  AND buchhaltung_belege.kategorie NOT IN ('privateinlage', 'privatentnahme', 'anlagevermögen')

UNION ALL

SELECT 'Bank' AS quelle,
       bank_transaktionen.transaktion_id AS referenz_id,
       bank_transaktionen.dojo_id AS dojo_id,
       bank_transaktionen.organisation_name AS organisation_name,
       bank_transaktionen.buchungsdatum AS datum,
       ABS(bank_transaktionen.betrag) AS betrag_brutto,
       COALESCE(bank_transaktionen.kategorie, 'sonstige_kosten') AS kategorie,
       CONCAT(bank_transaktionen.auftraggeber_empfaenger, ': ', COALESCE(bank_transaktionen.verwendungszweck, '')) AS beschreibung,
       YEAR(bank_transaktionen.buchungsdatum) AS jahr,
       MONTH(bank_transaktionen.buchungsdatum) AS monat
FROM bank_transaktionen
WHERE bank_transaktionen.betrag < 0
  AND bank_transaktionen.status = 'zugeordnet'
  AND bank_transaktionen.kategorie NOT IN ('privateinlage', 'privatentnahme')
  AND bank_transaktionen.beleg_id IS NULL

UNION ALL

SELECT 'Kasse' AS quelle,
       kassenbuch.eintrag_id AS referenz_id,
       COALESCE(kassenbuch.dojo_id, 1) AS dojo_id,
       CASE WHEN kassenbuch.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
       kassenbuch.geschaeft_datum AS datum,
       kassenbuch.betrag_cent / 100 AS betrag_brutto,
       'sonstige_kosten' AS kategorie,
       kassenbuch.beschreibung AS beschreibung,
       YEAR(kassenbuch.geschaeft_datum) AS jahr,
       MONTH(kassenbuch.geschaeft_datum) AS monat
FROM kassenbuch
WHERE kassenbuch.bewegungsart = 'ausgabe'

UNION ALL

SELECT 'AfA' AS quelle,
       ap.afa_id AS referenz_id,
       ap.dojo_id AS dojo_id,
       ap.organisation_name AS organisation_name,
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
