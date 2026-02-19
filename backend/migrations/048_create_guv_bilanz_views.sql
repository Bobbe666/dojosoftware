-- =====================================================
-- Migration 048: GuV und Bilanz Views
-- Erstellt Views für Gewinn- und Verlustrechnung (GuV)
-- und Bilanz-Berechnungen
-- =====================================================

-- =====================================================
-- 1. GuV-Daten View
-- Aggregiert Einnahmen/Ausgaben nach GuV-Kategorien
-- =====================================================

-- GuV-Daten View: Erst Einnahmen sammeln
CREATE OR REPLACE VIEW v_guv_einnahmen_grouped AS
SELECT
    dojo_id,
    organisation_name,
    jahr,
    monat,
    SUM(CASE WHEN kategorie = 'betriebseinnahmen' THEN betrag_brutto ELSE 0 END) as umsatzerloese
FROM v_euer_einnahmen
GROUP BY dojo_id, organisation_name, jahr, monat;

-- GuV-Daten View: Dann Ausgaben sammeln
CREATE OR REPLACE VIEW v_guv_ausgaben_grouped AS
SELECT
    dojo_id,
    organisation_name,
    jahr,
    monat,
    SUM(CASE WHEN kategorie = 'wareneingang' THEN betrag_brutto ELSE 0 END) as materialaufwand,
    SUM(CASE WHEN kategorie = 'personalkosten' THEN betrag_brutto ELSE 0 END) as personalaufwand,
    SUM(CASE WHEN kategorie = 'abschreibungen' THEN betrag_brutto ELSE 0 END) as abschreibungen,
    SUM(CASE WHEN kategorie IN ('raumkosten', 'versicherungen', 'kfz_kosten', 'werbekosten',
                               'reisekosten', 'telefon_internet', 'buerokosten', 'fortbildung',
                               'sonstige_kosten') THEN betrag_brutto ELSE 0 END) as sonstige_aufwendungen
FROM v_euer_ausgaben
GROUP BY dojo_id, organisation_name, jahr, monat;

-- GuV-Daten View: Kombination (LEFT JOIN reicht, da wir normalerweise Einnahmen haben)
CREATE OR REPLACE VIEW v_guv_daten AS
SELECT
    ein.dojo_id,
    ein.organisation_name,
    ein.jahr,
    ein.monat,
    COALESCE(ein.umsatzerloese, 0) as umsatzerloese,
    COALESCE(aus.materialaufwand, 0) as materialaufwand,
    COALESCE(aus.personalaufwand, 0) as personalaufwand,
    COALESCE(aus.abschreibungen, 0) as abschreibungen,
    COALESCE(aus.sonstige_aufwendungen, 0) as sonstige_aufwendungen
FROM v_guv_einnahmen_grouped ein
LEFT JOIN v_guv_ausgaben_grouped aus
    ON ein.dojo_id = aus.dojo_id
    AND ein.organisation_name = aus.organisation_name
    AND ein.jahr = aus.jahr
    AND ein.monat = aus.monat;

-- =====================================================
-- 2. Bilanz: Bank-Bestand View
-- Kumulierte Banksalden aus importierten Transaktionen
-- =====================================================

CREATE OR REPLACE VIEW v_bilanz_bank_bestand AS
SELECT
    COALESCE(dojo_id, 1) as dojo_id,
    organisation_name,
    YEAR(buchungsdatum) as jahr,
    SUM(betrag) as bank_saldo
FROM bank_transaktionen
WHERE status IN ('zugeordnet', 'ignoriert')
  AND kategorie NOT IN ('privateinlage', 'privatentnahme')
GROUP BY dojo_id, organisation_name, YEAR(buchungsdatum);

-- =====================================================
-- 3. Bilanz: Forderungen View
-- Offene Rechnungen als Forderungen
-- =====================================================

CREATE OR REPLACE VIEW v_bilanz_forderungen AS
SELECT
    dojo_id,
    YEAR(COALESCE(faelligkeitsdatum, datum)) as jahr,
    SUM(brutto_betrag - COALESCE(
        (SELECT SUM(betrag) FROM zahlungen z WHERE z.rechnung_id = r.rechnung_id),
        0
    )) as forderungen
FROM rechnungen r
WHERE status IN ('offen', 'teilweise_bezahlt', 'ueberfaellig')
  AND archiviert = 0
GROUP BY dojo_id, YEAR(COALESCE(faelligkeitsdatum, datum));

-- =====================================================
-- 4. Bilanz: Eigenkapital View
-- Kumuliertes Eigenkapital aus Jahresüberschüssen
-- =====================================================

CREATE OR REPLACE VIEW v_bilanz_eigenkapital AS
SELECT
    dojo_id,
    organisation_name,
    jahr,
    (COALESCE(einnahmen, 0) - COALESCE(ausgaben, 0)) as jahresueberschuss
FROM (
    SELECT
        dojo_id,
        organisation_name,
        jahr,
        SUM(betrag_brutto) as einnahmen
    FROM v_euer_einnahmen
    GROUP BY dojo_id, organisation_name, jahr
) ein
LEFT JOIN (
    SELECT
        dojo_id,
        organisation_name,
        jahr,
        SUM(betrag_brutto) as ausgaben
    FROM v_euer_ausgaben
    GROUP BY dojo_id, organisation_name, jahr
) aus USING (dojo_id, organisation_name, jahr);

-- =====================================================
-- Grant permissions
-- =====================================================
-- Views sind automatisch mit den Rechten der Basistabellen versehen
