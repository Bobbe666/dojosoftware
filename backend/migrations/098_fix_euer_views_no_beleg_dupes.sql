-- Migration 098: EÜR-View Fixierung — kein Doppeleintrag mehr für Bank-Matches
--
-- Problem: v_euer_einnahmen bank-branch schloss 'verkauf' nicht aus.
--          Beim Annehmen von beitrag/rechnung/verkauf-Vorschlägen wurde fälschlich
--          ein Beleg erstellt → Doppeleintrag in EÜR.
--          Der Code-Fix (buchhaltung.js) verhindert das ab sofort.
--          Diese Migration fixt nur die View.
--
-- AUDIT QUERY für bestehende Duplikate (VOR dem Stornieren prüfen!):
--   SELECT bt.transaktion_id, bt.buchungsdatum, bt.betrag, bt.match_typ,
--          bt.beleg_id, bb.beschreibung, bb.betrag_brutto
--   FROM bank_transaktionen bt
--   JOIN buchhaltung_belege bb ON bb.beleg_id = bt.beleg_id
--   WHERE bt.match_typ IN ('beitrag', 'rechnung', 'verkauf')
--     AND bt.beleg_id IS NOT NULL
--     AND bb.storniert = 0;
--
-- Falls diese Query Treffer liefert:
--   UPDATE buchhaltung_belege bb
--   INNER JOIN bank_transaktionen bt ON bt.beleg_id = bb.beleg_id
--   SET bb.storniert = 1
--   WHERE bt.match_typ IN ('beitrag', 'rechnung', 'verkauf')
--     AND bt.beleg_id IS NOT NULL;

-- -----------------------------------------------------------------------
-- v_euer_einnahmen — final correct version
-- Änderung: bank branch schließt jetzt auch 'verkauf' aus
-- -----------------------------------------------------------------------

CREATE OR REPLACE VIEW v_euer_einnahmen AS

-- Manuelle Belege (Einnahmen)
SELECT
    'beleg' as quelle,
    beleg_id as referenz_id,
    dojo_id,
    organisation_name,
    beleg_datum as datum,
    betrag_brutto,
    kategorie,
    beschreibung,
    YEAR(beleg_datum) as jahr,
    MONTH(beleg_datum) as monat
FROM buchhaltung_belege
WHERE buchungsart = 'einnahme'
  AND storniert = FALSE
  AND kategorie NOT IN ('privateinlage', 'privatentnahme')

UNION ALL

-- Mitgliedsbeiträge (nur bezahlt + kein Rechnungsbezug — sonst via rechnung)
SELECT
    'beitrag' as quelle,
    b.beitrag_id as referenz_id,
    b.dojo_id,
    CASE WHEN b.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    b.zahlungsdatum as datum,
    b.betrag,
    'mitgliedsbeitraege' as kategorie,
    CONCAT('Mitgliedsbeitrag ', MONTH(b.zahlungsdatum), '/', YEAR(b.zahlungsdatum)) as beschreibung,
    YEAR(b.zahlungsdatum) as jahr,
    MONTH(b.zahlungsdatum) as monat
FROM beitraege b
WHERE b.bezahlt = 1
  AND b.rechnung_id IS NULL

UNION ALL

-- Rechnungen
SELECT
    'rechnung' as quelle,
    r.rechnung_id as referenz_id,
    m.dojo_id,
    CASE WHEN m.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    r.bezahlt_am as datum,
    r.gesamtbetrag,
    'sonstige_einnahmen' as kategorie,
    CONCAT('Rechnung ', r.rechnung_nummer) as beschreibung,
    YEAR(r.bezahlt_am) as jahr,
    MONTH(r.bezahlt_am) as monat
FROM rechnungen r
JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
WHERE r.status = 'bezahlt'
  AND r.bezahlt_am IS NOT NULL

UNION ALL

-- Verkäufe
SELECT
    'verkauf' as quelle,
    v.verkauf_id as referenz_id,
    v.dojo_id,
    CASE WHEN v.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    v.verkauf_datum as datum,
    v.brutto_gesamt_cent / 100 as betrag_brutto,
    'sonstige_einnahmen' as kategorie,
    CONCAT('Verkauf ', COALESCE(v.bon_nummer, v.verkauf_id)) as beschreibung,
    YEAR(v.verkauf_datum) as jahr,
    MONTH(v.verkauf_datum) as monat
FROM verkaeufe v
WHERE v.storniert = 0

UNION ALL

-- Kassenbuch-Einnahmen
SELECT
    'kassenbuch' as quelle,
    k.eintrag_id as referenz_id,
    COALESCE(k.dojo_id, 1) as dojo_id,
    CASE WHEN k.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    k.geschaeft_datum as datum,
    k.betrag_cent / 100 as betrag_brutto,
    'sonstige_einnahmen' as kategorie,
    k.beschreibung,
    YEAR(k.geschaeft_datum) as jahr,
    MONTH(k.geschaeft_datum) as monat
FROM kassenbuch k
WHERE k.bewegungsart = 'einnahme'

UNION ALL

-- Bank-Einnahmen (nur ungematchte — beitrag/rechnung/verkauf kommen aus obigen Branches)
SELECT
    'bank' as quelle,
    bt.transaktion_id as referenz_id,
    bt.dojo_id,
    bt.organisation_name,
    bt.buchungsdatum as datum,
    bt.betrag as betrag_brutto,
    COALESCE(bt.kategorie, 'sonstige_einnahmen') as kategorie,
    bt.verwendungszweck as beschreibung,
    YEAR(bt.buchungsdatum) as jahr,
    MONTH(bt.buchungsdatum) as monat
FROM bank_transaktionen bt
WHERE bt.betrag > 0
  AND bt.status = 'zugeordnet'
  AND bt.kategorie NOT IN ('privateinlage', 'privatentnahme')
  AND bt.beleg_id IS NULL
  AND (bt.match_typ IS NULL OR bt.match_typ NOT IN ('rechnung', 'beitrag', 'verkauf'));
