-- ============================================================================
-- Migration 037: Bank-Import System
-- Ermöglicht Import von Kontoauszügen (CSV/MT940) mit Auto-Matching
-- ============================================================================

-- Tabelle für importierte Bank-Transaktionen
CREATE TABLE IF NOT EXISTS bank_transaktionen (
    transaktion_id INT AUTO_INCREMENT PRIMARY KEY,

    -- Import-Info
    import_id VARCHAR(50) NOT NULL,           -- Batch-ID für zusammengehörige Imports
    import_datum TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    import_datei VARCHAR(255),
    import_format ENUM('csv', 'mt940') NOT NULL,

    -- Organisation
    dojo_id INT NOT NULL,
    organisation_name VARCHAR(100),

    -- Bank-Daten (Original)
    buchungsdatum DATE NOT NULL,
    valutadatum DATE,
    betrag DECIMAL(10,2) NOT NULL,            -- Negativ = Ausgabe, Positiv = Einnahme
    waehrung VARCHAR(3) DEFAULT 'EUR',

    -- Details
    verwendungszweck TEXT,
    auftraggeber_empfaenger VARCHAR(255),
    iban_gegenkonto VARCHAR(34),
    bic VARCHAR(11),

    -- Zusätzliche Bank-Infos
    buchungstext VARCHAR(100),                 -- z.B. "SEPA-Überweisung", "Lastschrift"
    mandatsreferenz VARCHAR(50),
    kundenreferenz VARCHAR(50),

    -- Zuordnung
    status ENUM('unzugeordnet', 'vorgeschlagen', 'zugeordnet', 'ignoriert') DEFAULT 'unzugeordnet',
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
    ) NULL,

    -- Auto-Match-Ergebnis
    match_typ ENUM('rechnung', 'beitrag', 'verkauf', 'verbandsbeitrag', 'manuell') NULL,
    match_id INT NULL,                         -- ID des gematchten Datensatzes
    match_confidence DECIMAL(3,2) NULL,        -- 0.00 - 1.00
    match_details JSON,                        -- Details zum Match für Anzeige

    -- Verknüpfung zu Beleg (nach Zuordnung)
    beleg_id INT NULL,

    -- Hash für Duplikaterkennung
    hash_key VARCHAR(64),                      -- SHA256 von (datum + betrag + verwendungszweck)

    -- Audit
    zugeordnet_von INT NULL,
    zugeordnet_am TIMESTAMP NULL,

    -- Indizes
    INDEX idx_status (status),
    INDEX idx_import (import_id),
    INDEX idx_buchungsdatum (buchungsdatum),
    INDEX idx_dojo (dojo_id),
    INDEX idx_hash (hash_key),
    INDEX idx_organisation (organisation_name),

    CONSTRAINT fk_bank_beleg FOREIGN KEY (beleg_id)
        REFERENCES buchhaltung_belege(beleg_id) ON DELETE SET NULL
);

-- Tabelle für Import-Historie
CREATE TABLE IF NOT EXISTS bank_import_historie (
    import_id VARCHAR(50) PRIMARY KEY,

    dojo_id INT NOT NULL,
    organisation_name VARCHAR(100),

    datei_name VARCHAR(255),
    datei_format ENUM('csv', 'mt940') NOT NULL,
    bank_name VARCHAR(100),                    -- z.B. "Sparkasse", "Volksbank", "DKB"

    -- Statistiken
    anzahl_transaktionen INT DEFAULT 0,
    anzahl_zugeordnet INT DEFAULT 0,
    anzahl_ignoriert INT DEFAULT 0,
    anzahl_duplikate INT DEFAULT 0,

    -- Zeitraum der Transaktionen
    datum_von DATE,
    datum_bis DATE,

    -- Audit
    importiert_von INT NOT NULL,
    importiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_dojo (dojo_id),
    INDEX idx_datum (importiert_am)
);

-- Tabelle für gelernte Zuordnungen (Auto-Kategorisierung)
CREATE TABLE IF NOT EXISTS bank_zuordnung_regeln (
    regel_id INT AUTO_INCREMENT PRIMARY KEY,

    dojo_id INT NOT NULL,

    -- Matching-Kriterien
    match_feld ENUM('auftraggeber', 'verwendungszweck', 'iban') NOT NULL,
    match_wert VARCHAR(255) NOT NULL,          -- Der zu suchende String
    match_typ ENUM('exakt', 'enthält', 'beginnt_mit') DEFAULT 'enthält',

    -- Ziel-Kategorie
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

    -- Optional: Ignorieren statt kategorisieren
    aktion ENUM('kategorisieren', 'ignorieren') DEFAULT 'kategorisieren',

    -- Statistik
    verwendungen INT DEFAULT 0,

    -- Audit
    erstellt_von INT NOT NULL,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktiv BOOLEAN DEFAULT TRUE,

    INDEX idx_dojo (dojo_id),
    INDEX idx_aktiv (aktiv),
    UNIQUE KEY unique_regel (dojo_id, match_feld, match_wert, match_typ)
);
