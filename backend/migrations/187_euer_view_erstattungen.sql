-- ============================================================================
-- Migration 187: Erstattungen als negative Einnahmen in v_euer_einnahmen
-- ----------------------------------------------------------------------------
-- Rückerstattungen mindern die Einnahmen im Erstattungsdatum (§11 EStG
-- Abflussprinzip). Neuer UNION-Branch mit NEGATIVEM betrag_brutto.
-- Basis: Migration 098 (unverändert) + Erstattungs-Branch.
-- Wirksame Erstattungen = status IN ('erstattet','veranlasst').
-- ============================================================================

CREATE OR REPLACE VIEW v_euer_einnahmen AS

-- Manuelle Belege (Einnahmen)
SELECT
    'beleg' as quelle, beleg_id as referenz_id, dojo_id, organisation_name,
    beleg_datum as datum, betrag_brutto, kategorie, beschreibung,
    YEAR(beleg_datum) as jahr, MONTH(beleg_datum) as monat
FROM buchhaltung_belege
WHERE buchungsart = 'einnahme' AND storniert = FALSE
  AND kategorie NOT IN ('privateinlage', 'privatentnahme')

UNION ALL

-- Mitgliedsbeiträge (nur bezahlt + kein Rechnungsbezug)
SELECT
    'beitrag' as quelle, b.beitrag_id as referenz_id, b.dojo_id,
    CASE WHEN b.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END,
    b.zahlungsdatum as datum, b.betrag, 'mitgliedsbeitraege' as kategorie,
    CONCAT('Mitgliedsbeitrag ', MONTH(b.zahlungsdatum), '/', YEAR(b.zahlungsdatum)),
    YEAR(b.zahlungsdatum) as jahr, MONTH(b.zahlungsdatum) as monat
FROM beitraege b
WHERE b.bezahlt = 1 AND b.rechnung_id IS NULL

UNION ALL

-- Rechnungen
SELECT
    'rechnung' as quelle, r.rechnung_id as referenz_id, m.dojo_id,
    CASE WHEN m.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END,
    r.bezahlt_am as datum, r.gesamtbetrag, 'sonstige_einnahmen' as kategorie,
    CONCAT('Rechnung ', r.rechnung_nummer),
    YEAR(r.bezahlt_am) as jahr, MONTH(r.bezahlt_am) as monat
FROM rechnungen r
JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL

UNION ALL

-- Verkäufe
SELECT
    'verkauf' as quelle, v.verkauf_id as referenz_id, v.dojo_id,
    CASE WHEN v.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END,
    v.verkauf_datum as datum, v.brutto_gesamt_cent / 100, 'sonstige_einnahmen' as kategorie,
    CONCAT('Verkauf ', COALESCE(v.bon_nummer, v.verkauf_id)),
    YEAR(v.verkauf_datum) as jahr, MONTH(v.verkauf_datum) as monat
FROM verkaeufe v
WHERE v.storniert = 0

UNION ALL

-- Kassenbuch-Einnahmen
SELECT
    'kassenbuch' as quelle, k.eintrag_id as referenz_id, COALESCE(k.dojo_id, 1) as dojo_id,
    CASE WHEN k.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END,
    k.geschaeft_datum as datum, k.betrag_cent / 100, 'sonstige_einnahmen' as kategorie,
    k.beschreibung, YEAR(k.geschaeft_datum) as jahr, MONTH(k.geschaeft_datum) as monat
FROM kassenbuch k
WHERE k.bewegungsart = 'einnahme'

UNION ALL

-- Bank-Einnahmen (nur ungematchte)
SELECT
    'bank' as quelle, bt.transaktion_id as referenz_id, bt.dojo_id, bt.organisation_name,
    bt.buchungsdatum as datum, bt.betrag, COALESCE(bt.kategorie, 'sonstige_einnahmen'),
    bt.verwendungszweck, YEAR(bt.buchungsdatum) as jahr, MONTH(bt.buchungsdatum) as monat
FROM bank_transaktionen bt
WHERE bt.betrag > 0 AND bt.status = 'zugeordnet'
  AND bt.kategorie NOT IN ('privateinlage', 'privatentnahme')
  AND bt.beleg_id IS NULL
  AND (bt.match_typ IS NULL OR bt.match_typ NOT IN ('rechnung', 'beitrag', 'verkauf'))

UNION ALL

-- Erstattungen (NEGATIVE Einnahmen, §11 EStG Abflussprinzip)
SELECT
    'erstattung' as quelle, e.id as referenz_id, e.dojo_id,
    CASE WHEN e.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END,
    e.erstattet_am as datum, -e.betrag, 'erstattungen' as kategorie,
    CONCAT('Erstattung ', COALESCE(e.quelle_art, 'sonstige'), ' ', MONTH(e.erstattet_am), '/', YEAR(e.erstattet_am)),
    YEAR(e.erstattet_am) as jahr, MONTH(e.erstattet_am) as monat
FROM erstattungen e
WHERE e.status IN ('erstattet', 'veranlasst');
