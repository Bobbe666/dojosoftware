-- ============================================================================
-- Migration 187: Erstattungen als negative Einnahmen in v_euer_einnahmen
-- ----------------------------------------------------------------------------
-- Rückerstattungen mindern die Einnahmen im Erstattungsdatum (§11 EStG).
-- Basis: AKTUELLE View-Definition (Stand 2026-06, via SHOW CREATE VIEW) +
-- neuer Erstattungs-Branch mit NEGATIVEM betrag_brutto.
-- Wirksame Erstattungen = status IN ('erstattet','veranlasst').
-- ============================================================================

-- Collation an die übrigen Tabellen angleichen (sonst UNION-Collation-Konflikt)
ALTER TABLE erstattungen CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW v_euer_einnahmen AS

SELECT 'Beleg' AS quelle, b.beleg_id AS referenz_id, b.dojo_id, b.organisation_name,
       b.beleg_datum AS datum, b.betrag_brutto, b.kategorie, b.beschreibung,
       YEAR(b.beleg_datum) AS jahr, MONTH(b.beleg_datum) AS monat
FROM buchhaltung_belege b
WHERE b.buchungsart = 'einnahme' AND b.storniert = 0
  AND b.kategorie NOT IN ('privateinlage','privatentnahme')

UNION ALL

SELECT 'Beitrag' AS quelle, b.beitrag_id AS referenz_id, COALESCE(b.dojo_id,1) AS dojo_id,
       CASE WHEN b.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
       b.zahlungsdatum AS datum, b.betrag AS betrag_brutto, 'betriebseinnahmen' AS kategorie,
       CONCAT('Mitgliedsbeitrag ', MONTH(b.zahlungsdatum), '/', YEAR(b.zahlungsdatum)) AS beschreibung,
       YEAR(b.zahlungsdatum) AS jahr, MONTH(b.zahlungsdatum) AS monat
FROM beitraege b
WHERE b.bezahlt = 1 AND b.rechnung_id IS NULL AND b.euer_ausblenden = 0

UNION ALL

SELECT 'Rechnung' AS quelle, r.rechnung_id AS referenz_id, COALESCE(r.dojo_id,1) AS dojo_id,
       CASE WHEN r.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
       r.bezahlt_am AS datum, COALESCE(r.brutto_betrag, r.betrag) AS betrag_brutto, 'betriebseinnahmen' AS kategorie,
       CONCAT('Rechnung ', r.rechnungsnummer) AS beschreibung,
       YEAR(r.bezahlt_am) AS jahr, MONTH(r.bezahlt_am) AS monat
FROM rechnungen r
WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL

UNION ALL

SELECT 'Verkauf' AS quelle, v.verkauf_id AS referenz_id, COALESCE(v.dojo_id,1) AS dojo_id,
       CASE WHEN v.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
       v.verkauf_datum AS datum, v.brutto_gesamt_cent / 100 AS betrag_brutto, 'betriebseinnahmen' AS kategorie,
       CONCAT('Verkauf ', v.bon_nummer) AS beschreibung,
       YEAR(v.verkauf_datum) AS jahr, MONTH(v.verkauf_datum) AS monat
FROM verkaeufe v

UNION ALL

SELECT 'Bank' AS quelle, bt.transaktion_id AS referenz_id, bt.dojo_id, bt.organisation_name,
       bt.buchungsdatum AS datum, bt.betrag AS betrag_brutto, COALESCE(bt.kategorie,'betriebseinnahmen') AS kategorie,
       CONCAT(bt.auftraggeber_empfaenger, ': ', COALESCE(bt.verwendungszweck,'')) AS beschreibung,
       YEAR(bt.buchungsdatum) AS jahr, MONTH(bt.buchungsdatum) AS monat
FROM bank_transaktionen bt
WHERE bt.betrag > 0 AND bt.status = 'zugeordnet'
  AND bt.kategorie NOT IN ('privateinlage','privatentnahme')
  AND bt.beleg_id IS NULL
  AND (bt.match_typ IS NULL OR bt.match_typ NOT IN ('rechnung','beitrag','verkauf'))

UNION ALL

SELECT 'Kasse' AS quelle, k.eintrag_id AS referenz_id, COALESCE(k.dojo_id,1) AS dojo_id,
       CASE WHEN k.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
       k.geschaeft_datum AS datum, k.betrag_cent / 100 AS betrag_brutto, 'betriebseinnahmen' AS kategorie,
       k.beschreibung, YEAR(k.geschaeft_datum) AS jahr, MONTH(k.geschaeft_datum) AS monat
FROM kassenbuch k
WHERE k.bewegungsart = 'einnahme'

UNION ALL

-- Erstattungen (NEGATIVE Einnahmen, §11 EStG Abflussprinzip)
SELECT 'Erstattung' AS quelle, e.id AS referenz_id, e.dojo_id,
       CASE WHEN e.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END AS organisation_name,
       e.erstattet_am AS datum, -e.betrag AS betrag_brutto, 'erstattungen' AS kategorie,
       CONCAT('Erstattung ', COALESCE(e.quelle_art,'sonstige'), ' ', MONTH(e.erstattet_am), '/', YEAR(e.erstattet_am)) AS beschreibung,
       YEAR(e.erstattet_am) AS jahr, MONTH(e.erstattet_am) AS monat
FROM erstattungen e
WHERE e.status IN ('erstattet','veranlasst');
