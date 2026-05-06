-- Migration 152: Mahnungen-Tabelle auf korrektes Schema bringen
-- Die ursprüngliche Tabelle aus Migration 100 hatte beitrag_id als FK (falsch).
-- Das Backend verwendet rechnung_id, dojo_id, schuldner_name, etc.

DROP TABLE IF EXISTS mahnungen;

CREATE TABLE mahnungen (
  mahnung_id      INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id         INT NOT NULL,
  organisation_name VARCHAR(100) NOT NULL DEFAULT '',
  rechnung_id     INT DEFAULT NULL,
  mitglied_id     INT DEFAULT NULL,
  schuldner_name  VARCHAR(255) NOT NULL,
  offener_betrag  DECIMAL(12,2) NOT NULL,
  faelligkeitsdatum DATE NOT NULL,
  mahnstufe       TINYINT NOT NULL DEFAULT 1,
  mahngebuehr     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  mahntext        TEXT DEFAULT NULL,
  versandt_am     DATE DEFAULT NULL,
  versandt_per    VARCHAR(50) DEFAULT NULL,
  bezahlt_am      DATE DEFAULT NULL,
  storniert       TINYINT(1) NOT NULL DEFAULT 0,
  erstellt_von    INT DEFAULT NULL,
  erstellt_am     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo       (dojo_id),
  INDEX idx_rechnung   (rechnung_id),
  INDEX idx_mitglied   (mitglied_id),
  INDEX idx_storniert  (storniert),
  INDEX idx_bezahlt    (bezahlt_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Beleg 388 korrigieren: buchungsart=ausgabe aber kategorie=betriebseinnahmen
-- "Geld überwiesen an Harlander Anna Maria" → sonstige_kosten
UPDATE buchhaltung_belege
SET kategorie = 'sonstige_kosten'
WHERE beleg_id = 388
  AND buchungsart = 'ausgabe'
  AND kategorie = 'betriebseinnahmen';

-- v_euer_ausgaben absichern: betriebseinnahmen-Kategorie in Ausgaben ausschließen
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
    AND b.kategorie NOT IN ('privateinlage', 'privatentnahme', 'anlagevermögen', 'betriebseinnahmen')

  UNION ALL

  SELECT 'AfA' AS quelle,
         a.anlage_id AS referenz_id,
         a.dojo_id,
         a.organisation_name,
         MAKEDATE(a.afa_jahr, 1) AS datum,
         a.afa_betrag AS betrag_brutto,
         'abschreibungen' AS kategorie,
         CONCAT('AfA: ', a.bezeichnung) AS beschreibung,
         a.afa_jahr AS jahr,
         1 AS monat
  FROM anlagevermögen a
  WHERE a.aktiv = 1
    AND a.afa_betrag > 0

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
    AND bt.kategorie NOT IN ('privateinlage', 'privatentnahme', 'betriebseinnahmen')
    AND bt.beleg_id IS NULL
    AND (bt.match_typ IS NULL OR bt.match_typ NOT IN ('rechnung', 'beitrag', 'verkauf'))

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
  WHERE k.bewegungsart = 'ausgabe';
