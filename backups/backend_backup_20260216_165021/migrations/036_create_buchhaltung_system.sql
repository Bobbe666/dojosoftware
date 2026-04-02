-- ============================================================================
-- Migration 036: Buchhaltungs-System (EÜR - Einnahmen-Überschuss-Rechnung)
-- GoBD-konform mit Audit-Trail und Unveränderlichkeit
-- ============================================================================

-- Tabelle für manuelle Belegerfassung
CREATE TABLE IF NOT EXISTS buchhaltung_belege (
    beleg_id INT AUTO_INCREMENT PRIMARY KEY,
    beleg_nummer VARCHAR(50) NOT NULL,

    -- Organisation
    dojo_id INT NOT NULL,
    organisation_name VARCHAR(100), -- "TDA International" oder "Kampfkunstschule Schreiner"

    -- Buchungsart
    buchungsart ENUM('einnahme', 'ausgabe') NOT NULL,

    -- Belegdaten
    beleg_datum DATE NOT NULL,
    buchungsdatum DATE NOT NULL,

    -- Betrag
    betrag_netto DECIMAL(10,2) NOT NULL,
    mwst_satz DECIMAL(5,2) DEFAULT 19.00,
    mwst_betrag DECIMAL(10,2),
    betrag_brutto DECIMAL(10,2) NOT NULL,

    -- Kategorisierung (EÜR-Konten nach SKR03)
    kategorie ENUM(
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
        'sonstige_kosten'
    ) NOT NULL,

    -- Details
    beschreibung TEXT NOT NULL,
    lieferant_kunde VARCHAR(255),
    rechnungsnummer_extern VARCHAR(100),

    -- Beleg-Datei
    datei_pfad VARCHAR(500),
    datei_name VARCHAR(255),
    datei_typ VARCHAR(50),
    datei_groesse INT,

    -- Verknüpfungen zu bestehenden Daten (optional)
    rechnung_id INT NULL,
    verkauf_id INT NULL,
    kassenbuch_id INT NULL,

    -- Audit-Trail (GoBD-konform)
    erstellt_von INT NOT NULL,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geaendert_von INT NULL,
    geaendert_am TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

    -- Unveränderlichkeit nach Festschreibung
    festgeschrieben BOOLEAN DEFAULT FALSE,
    festgeschrieben_am TIMESTAMP NULL,
    festgeschrieben_von INT NULL,

    -- Storno (statt Löschen für GoBD)
    storniert BOOLEAN DEFAULT FALSE,
    storno_grund TEXT,
    storno_am TIMESTAMP NULL,
    storno_von INT NULL,

    -- Indizes für Performance
    INDEX idx_beleg_datum (beleg_datum),
    INDEX idx_dojo_kategorie (dojo_id, kategorie),
    INDEX idx_buchungsjahr (dojo_id, buchungsdatum),
    INDEX idx_beleg_nummer (beleg_nummer),
    INDEX idx_organisation (organisation_name),
    INDEX idx_buchungsart (buchungsart)
);

-- Tabelle für Jahresabschlüsse
CREATE TABLE IF NOT EXISTS euer_abschluesse (
    abschluss_id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    organisation_name VARCHAR(100),
    jahr INT NOT NULL,

    -- Summen
    summe_einnahmen DECIMAL(12,2) DEFAULT 0.00,
    summe_ausgaben DECIMAL(12,2) DEFAULT 0.00,
    gewinn_verlust DECIMAL(12,2) DEFAULT 0.00,

    -- Detailsummen nach Kategorie (JSON für Flexibilität)
    einnahmen_details JSON,
    ausgaben_details JSON,

    -- Status
    status ENUM('offen', 'vorläufig', 'abgeschlossen') DEFAULT 'offen',
    abgeschlossen_am TIMESTAMP NULL,
    abgeschlossen_von INT NULL,

    -- Export-Tracking
    letzter_export_datum TIMESTAMP NULL,
    letzter_export_format VARCHAR(20),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

    -- Ein Abschluss pro Organisation/Jahr
    UNIQUE KEY unique_org_jahr (dojo_id, organisation_name, jahr),
    INDEX idx_jahr (jahr),
    INDEX idx_status (status)
);

-- Tabelle für Buchungsprotokoll (Audit-Log für GoBD)
CREATE TABLE IF NOT EXISTS buchhaltung_audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,

    -- Referenz zum Beleg
    beleg_id INT NOT NULL,

    -- Aktion
    aktion ENUM('erstellt', 'geaendert', 'festgeschrieben', 'storniert', 'export') NOT NULL,

    -- Änderungsdetails
    alte_werte JSON,
    neue_werte JSON,

    -- Benutzer und Zeitstempel
    benutzer_id INT NOT NULL,
    benutzer_name VARCHAR(255),
    ip_adresse VARCHAR(45),

    -- Timestamp (unveränderlich)
    zeitstempel TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_beleg (beleg_id),
    INDEX idx_zeitstempel (zeitstempel),
    INDEX idx_benutzer (benutzer_id)
);

-- Trigger für automatische Audit-Log-Einträge bei Änderungen
DELIMITER //

CREATE TRIGGER buchhaltung_belege_after_update
AFTER UPDATE ON buchhaltung_belege
FOR EACH ROW
BEGIN
    -- Nur loggen wenn noch nicht festgeschrieben
    IF OLD.festgeschrieben = FALSE THEN
        INSERT INTO buchhaltung_audit_log (
            beleg_id,
            aktion,
            alte_werte,
            neue_werte,
            benutzer_id,
            benutzer_name
        )
        VALUES (
            NEW.beleg_id,
            CASE
                WHEN NEW.festgeschrieben = TRUE AND OLD.festgeschrieben = FALSE THEN 'festgeschrieben'
                WHEN NEW.storniert = TRUE AND OLD.storniert = FALSE THEN 'storniert'
                ELSE 'geaendert'
            END,
            JSON_OBJECT(
                'betrag_brutto', OLD.betrag_brutto,
                'beschreibung', OLD.beschreibung,
                'kategorie', OLD.kategorie
            ),
            JSON_OBJECT(
                'betrag_brutto', NEW.betrag_brutto,
                'beschreibung', NEW.beschreibung,
                'kategorie', NEW.kategorie
            ),
            COALESCE(NEW.geaendert_von, NEW.erstellt_von),
            ''
        );
    END IF;
END //

DELIMITER ;

-- View für EÜR-Übersicht (kombiniert alle Einnahmequellen)
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
WHERE buchungsart = 'einnahme' AND storniert = FALSE

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

-- Verkäufe (Kasse)
SELECT
    'verkauf' as quelle,
    v.verkauf_id as referenz_id,
    COALESCE(v.dojo_id, 1) as dojo_id,
    CASE WHEN v.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    v.verkauf_datum as datum,
    v.brutto_gesamt_cent / 100 as betrag_brutto,
    'betriebseinnahmen' as kategorie,
    'Kassenverkauf' as beschreibung,
    YEAR(v.verkauf_datum) as jahr,
    MONTH(v.verkauf_datum) as monat
FROM verkaeufe v
WHERE v.storniert = 0

UNION ALL

-- Verbandsbeiträge (TDA)
SELECT
    'verbandsbeitrag' as quelle,
    z.id as referenz_id,
    2 as dojo_id,
    'TDA International' as organisation_name,
    COALESCE(z.bezahlt_am, z.rechnungsdatum) as datum,
    z.betrag_brutto as betrag_brutto,
    'betriebseinnahmen' as kategorie,
    CONCAT('Verbandsbeitrag ', z.rechnungsnummer) as beschreibung,
    YEAR(COALESCE(z.bezahlt_am, z.rechnungsdatum)) as jahr,
    MONTH(COALESCE(z.bezahlt_am, z.rechnungsdatum)) as monat
FROM verbandsmitgliedschaft_zahlungen z
WHERE z.status = 'bezahlt'

UNION ALL

-- Mitgliedsbeiträge
SELECT
    'beitrag' as quelle,
    b.beitrag_id as referenz_id,
    COALESCE(b.dojo_id, 1) as dojo_id,
    CASE WHEN b.dojo_id = 2 THEN 'TDA International' ELSE 'Kampfkunstschule Schreiner' END as organisation_name,
    b.zahlungsdatum as datum,
    b.betrag as betrag_brutto,
    'betriebseinnahmen' as kategorie,
    'Mitgliedsbeitrag' as beschreibung,
    YEAR(b.zahlungsdatum) as jahr,
    MONTH(b.zahlungsdatum) as monat
FROM beitraege b
WHERE b.bezahlt = 1 AND b.zahlungsdatum IS NOT NULL;

-- View für EÜR-Ausgaben
CREATE OR REPLACE VIEW v_euer_ausgaben AS
-- Manuelle Belege (Ausgaben)
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
WHERE buchungsart = 'ausgabe' AND storniert = FALSE

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
WHERE k.bewegungsart = 'ausgabe';
