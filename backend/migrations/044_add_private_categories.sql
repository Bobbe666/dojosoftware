-- ============================================================================
-- Migration 044: Privateinlagen und Privatentnahmen
-- Diese Kategorien beeinflussen NICHT den Gewinn der EÜR
-- ============================================================================

-- Erweitere die ENUM in buchhaltung_belege
ALTER TABLE buchhaltung_belege
MODIFY COLUMN kategorie ENUM(
    'betriebseinnahmen',
    'wareneingang',
    'personalkosten',
    'raumkosten',
    'versicherungen',
    'kfz_kosten',
    'werbekosten',
    'reisekosten',
    'telefon_internet',
    'buerokosten',
    'fortbildung',
    'abschreibungen',
    'sonstige_kosten',
    'privateinlage',
    'privatentnahme'
) NULL;

-- Erweitere die ENUM in bank_transaktionen
ALTER TABLE bank_transaktionen
MODIFY COLUMN kategorie ENUM(
    'betriebseinnahmen',
    'wareneingang',
    'personalkosten',
    'raumkosten',
    'versicherungen',
    'kfz_kosten',
    'werbekosten',
    'reisekosten',
    'telefon_internet',
    'buerokosten',
    'fortbildung',
    'abschreibungen',
    'sonstige_kosten',
    'privateinlage',
    'privatentnahme'
) NULL;

-- Erweitere die ENUM in bank_zuordnung_regeln
ALTER TABLE bank_zuordnung_regeln
MODIFY COLUMN kategorie ENUM(
    'betriebseinnahmen',
    'wareneingang',
    'personalkosten',
    'raumkosten',
    'versicherungen',
    'kfz_kosten',
    'werbekosten',
    'reisekosten',
    'telefon_internet',
    'buerokosten',
    'fortbildung',
    'abschreibungen',
    'sonstige_kosten',
    'privateinlage',
    'privatentnahme'
) NOT NULL;

-- Aktualisiere die View für EÜR-Einnahmen (OHNE Privateinlagen)
CREATE OR REPLACE VIEW v_euer_einnahmen AS
-- Manuelle Belege (Einnahmen) - ohne Privateinlagen
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

-- Bezahlte Rechnungen
SELECT
    'rechnung' as quelle,
    r.rechnung_id as referenz_id,
    1 as dojo_id,
    'Kampfkunstschule Schreiner' as organisation_name,
    COALESCE(r.bezahlt_am, r.faelligkeitsdatum) as datum,
    r.brutto_betrag as betrag_brutto,
    'betriebseinnahmen' as kategorie,
    CONCAT('Rechnung ', r.rechnungsnummer) as beschreibung,
    YEAR(COALESCE(r.bezahlt_am, r.faelligkeitsdatum)) as jahr,
    MONTH(COALESCE(r.bezahlt_am, r.faelligkeitsdatum)) as monat
FROM rechnungen r
WHERE r.status = 'bezahlt'

UNION ALL

-- Gebuchte Beiträge
SELECT
    'beitrag' as quelle,
    b.beitrag_id as referenz_id,
    COALESCE(m.dojo_id, 1) as dojo_id,
    'Kampfkunstschule Schreiner' as organisation_name,
    b.faellig_am as datum,
    b.betrag as betrag_brutto,
    'betriebseinnahmen' as kategorie,
    CONCAT('Mitgliedsbeitrag ', COALESCE(m.vorname, ''), ' ', COALESCE(m.nachname, '')) as beschreibung,
    YEAR(b.faellig_am) as jahr,
    MONTH(b.faellig_am) as monat
FROM beitraege b
LEFT JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
WHERE b.status = 'gebucht'

UNION ALL

-- Kassenbuch-Einnahmen (Verkäufe)
SELECT
    'verkauf' as quelle,
    v.verkauf_id as referenz_id,
    COALESCE(v.dojo_id, 1) as dojo_id,
    CASE WHEN v.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    v.verkauf_datum as datum,
    v.gesamt_brutto as betrag_brutto,
    'betriebseinnahmen' as kategorie,
    CONCAT('Verkauf #', v.verkauf_id) as beschreibung,
    YEAR(v.verkauf_datum) as jahr,
    MONTH(v.verkauf_datum) as monat
FROM verkaeufe v
WHERE v.bezahlt = TRUE;

-- Aktualisiere die View für EÜR-Ausgaben (OHNE Privatentnahmen)
CREATE OR REPLACE VIEW v_euer_ausgaben AS
-- Manuelle Belege (Ausgaben) - ohne Privatentnahmen
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
WHERE buchungsart = 'ausgabe'
  AND storniert = FALSE
  AND kategorie NOT IN ('privateinlage', 'privatentnahme')

UNION ALL

-- Kassenbuch-Ausgaben
SELECT
    'kassenbuch' as quelle,
    k.eintrag_id as referenz_id,
    COALESCE(k.dojo_id, 1) as dojo_id,
    CASE WHEN k.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    k.geschaeft_datum as datum,
    k.betrag_cent / 100 as betrag_brutto,
    'sonstige_kosten' as kategorie,
    k.beschreibung,
    YEAR(k.geschaeft_datum) as jahr,
    MONTH(k.geschaeft_datum) as monat
FROM kassenbuch k
WHERE k.typ = 'ausgabe';

-- Neue View für Privatbuchungen (zur Übersicht)
CREATE OR REPLACE VIEW v_euer_privat AS
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
WHERE kategorie IN ('privateinlage', 'privatentnahme')
  AND storniert = FALSE;
