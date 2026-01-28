-- ============================================================================
-- Migration 037: Verbandsmitgliedschaften (TDA International)
-- Dojo-Mitgliedschaft: 99 EUR/Jahr
-- Einzelmitgliedschaft: 49 EUR/Jahr
-- ============================================================================

-- Haupttabelle für Verbandsmitgliedschaften
CREATE TABLE IF NOT EXISTS verbandsmitgliedschaften (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Typ: dojo oder einzelperson
    typ ENUM('dojo', 'einzelperson') NOT NULL,

    -- Für Dojo-Mitgliedschaften
    dojo_id INT NULL,

    -- Für Einzelmitgliedschaften (Person muss nicht Dojo-Mitglied sein)
    person_vorname VARCHAR(100) NULL,
    person_nachname VARCHAR(100) NULL,
    person_email VARCHAR(255) NULL,
    person_telefon VARCHAR(50) NULL,
    person_strasse VARCHAR(255) NULL,
    person_plz VARCHAR(10) NULL,
    person_ort VARCHAR(100) NULL,
    person_land VARCHAR(100) DEFAULT 'Deutschland',
    person_geburtsdatum DATE NULL,

    -- Optional: Verknüpfung zu bestehendem Mitglied
    mitglied_id INT NULL,

    -- Mitgliedsnummer (z.B. TDA-D-0001 für Dojo, TDA-E-0001 für Einzel)
    mitgliedsnummer VARCHAR(20) NOT NULL UNIQUE,

    -- Beitrag
    jahresbeitrag DECIMAL(10,2) NOT NULL,

    -- Laufzeit
    gueltig_von DATE NOT NULL,
    gueltig_bis DATE NOT NULL,

    -- Status
    status ENUM('aktiv', 'ausstehend', 'abgelaufen', 'gekuendigt') DEFAULT 'ausstehend',

    -- Vorteile als JSON
    vorteile JSON NULL,

    -- Zahlungsinformationen
    zahlungsart ENUM('rechnung', 'lastschrift', 'paypal', 'ueberweisung') DEFAULT 'rechnung',

    -- SEPA-Daten (optional)
    sepa_iban VARCHAR(34) NULL,
    sepa_bic VARCHAR(11) NULL,
    sepa_kontoinhaber VARCHAR(100) NULL,
    sepa_mandatsreferenz VARCHAR(35) NULL,
    sepa_mandatsdatum DATE NULL,

    -- Notizen
    notizen TEXT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indizes
    INDEX idx_typ (typ),
    INDEX idx_status (status),
    INDEX idx_gueltig_bis (gueltig_bis),
    INDEX idx_dojo_id (dojo_id),
    INDEX idx_mitglied_id (mitglied_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Verbandsbeitrags-Zahlungen
CREATE TABLE IF NOT EXISTS verbandsmitgliedschaft_zahlungen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    verbandsmitgliedschaft_id INT NOT NULL,

    -- Rechnungsdaten
    rechnungsnummer VARCHAR(50) NULL,
    rechnungsdatum DATE NOT NULL,
    faellig_am DATE NOT NULL,

    -- Beträge
    betrag_netto DECIMAL(10,2) NOT NULL,
    mwst_satz DECIMAL(5,2) DEFAULT 19.00,
    mwst_betrag DECIMAL(10,2) NOT NULL,
    betrag_brutto DECIMAL(10,2) NOT NULL,

    -- Zeitraum
    zeitraum_von DATE NOT NULL,
    zeitraum_bis DATE NOT NULL,

    -- Zahlungsstatus
    status ENUM('offen', 'bezahlt', 'storniert', 'gemahnt') DEFAULT 'offen',
    bezahlt_am DATE NULL,
    zahlungsart VARCHAR(50) NULL,
    transaktions_id VARCHAR(100) NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_rechnungsdatum (rechnungsdatum),
    INDEX idx_verbandsmitgliedschaft_id (verbandsmitgliedschaft_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Vorteile/Rabatte der Verbandsmitgliedschaft
CREATE TABLE IF NOT EXISTS verband_vorteile (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Für welchen Mitgliedstyp gilt der Vorteil
    gilt_fuer ENUM('dojo', 'einzelperson', 'beide') NOT NULL DEFAULT 'beide',

    -- Vorteilsdetails
    titel VARCHAR(100) NOT NULL,
    beschreibung TEXT NULL,

    -- Rabatt
    rabatt_typ ENUM('prozent', 'festbetrag') DEFAULT 'prozent',
    rabatt_wert DECIMAL(10,2) NOT NULL,

    -- Gültig für (z.B. 'turnier', 'seminar', 'pruefung', 'shop')
    kategorie VARCHAR(50) NOT NULL,

    -- Aktiv?
    aktiv BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Standard-Vorteile einfügen
INSERT INTO verband_vorteile (gilt_fuer, titel, beschreibung, rabatt_typ, rabatt_wert, kategorie) VALUES
('dojo', 'Turnier-Startgebuehr Rabatt', 'Reduzierte Startgebuehren fuer alle Dojo-Mitglieder bei TDA-Turnieren', 'prozent', 20.00, 'turnier'),
('dojo', 'Seminar-Rabatt', 'Ermaessigte Teilnahmegebuehren fuer TDA-Seminare', 'prozent', 15.00, 'seminar'),
('dojo', 'Pruefungsgebuehr-Rabatt', 'Reduzierte Pruefungsgebuehren fuer Graduierungen', 'prozent', 10.00, 'pruefung'),
('einzelperson', 'Turnier-Startgebuehr Rabatt', 'Reduzierte Startgebuehren bei TDA-Turnieren', 'prozent', 15.00, 'turnier'),
('einzelperson', 'Seminar-Rabatt', 'Ermaessigte Teilnahmegebuehren fuer TDA-Seminare', 'prozent', 10.00, 'seminar'),
('beide', 'Shop-Rabatt', 'Rabatt auf TDA-Merchandise und Equipment', 'prozent', 10.00, 'shop');

-- Sequenz für Mitgliedsnummern
CREATE TABLE IF NOT EXISTS verband_nummern_sequenz (
    typ VARCHAR(20) PRIMARY KEY,
    aktuelle_nummer INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO verband_nummern_sequenz (typ, aktuelle_nummer) VALUES
('dojo', 0),
('einzelperson', 0)
ON DUPLICATE KEY UPDATE typ = typ;
