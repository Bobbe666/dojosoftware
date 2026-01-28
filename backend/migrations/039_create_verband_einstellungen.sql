-- ============================================================================
-- Migration 039: Verband Einstellungen
-- Konfiguration für Verbandsmitgliedschaften (Preise, Laufzeiten, etc.)
-- ============================================================================

-- Einstellungen-Tabelle
CREATE TABLE IF NOT EXISTS verband_einstellungen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    einstellung_key VARCHAR(100) NOT NULL UNIQUE,
    einstellung_value TEXT,
    einstellung_typ ENUM('text', 'number', 'boolean', 'json') DEFAULT 'text',
    kategorie VARCHAR(50) DEFAULT 'allgemein',
    label VARCHAR(200),
    beschreibung TEXT,
    sortierung INT DEFAULT 0,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Standard-Einstellungen einfügen
INSERT INTO verband_einstellungen (einstellung_key, einstellung_value, einstellung_typ, kategorie, label, beschreibung, sortierung) VALUES
-- Preise
('preis_dojo_mitgliedschaft', '99.00', 'number', 'preise', 'Dojo-Mitgliedschaft (€/Jahr)', 'Jahresbeitrag für Dojo-Mitgliedschaften', 10),
('preis_einzel_mitgliedschaft', '49.00', 'number', 'preise', 'Einzelmitgliedschaft (€/Jahr)', 'Jahresbeitrag für Einzelmitgliedschaften', 20),
('mwst_satz', '19', 'number', 'preise', 'MwSt-Satz (%)', 'Mehrwertsteuersatz für Rechnungen', 30),
('preise_sind_brutto', 'true', 'boolean', 'preise', 'Preise sind Bruttopreise', 'Wenn aktiviert, sind die angegebenen Preise inkl. MwSt', 40),

-- Laufzeiten
('laufzeit_monate', '12', 'number', 'laufzeiten', 'Standard-Laufzeit (Monate)', 'Standardlaufzeit für neue Mitgliedschaften', 10),
('kuendigungsfrist_monate', '3', 'number', 'laufzeiten', 'Kündigungsfrist (Monate)', 'Kündigungsfrist vor Ablauf', 20),
('auto_verlaengerung', 'true', 'boolean', 'laufzeiten', 'Automatische Verlängerung', 'Mitgliedschaften verlängern sich automatisch', 30),
('erinnerung_tage_vorher', '30', 'number', 'laufzeiten', 'Erinnerung (Tage vorher)', 'Tage vor Ablauf wird eine Erinnerung gesendet', 40),

-- Zahlungen
('zahlungsfrist_tage', '14', 'number', 'zahlungen', 'Zahlungsfrist (Tage)', 'Zahlungsziel auf Rechnungen', 10),
('zahlungsarten', '["rechnung", "lastschrift", "ueberweisung", "paypal"]', 'json', 'zahlungen', 'Erlaubte Zahlungsarten', 'Verfügbare Zahlungsmethoden', 20),
('sepa_glaeubigerid', '', 'text', 'zahlungen', 'SEPA Gläubiger-ID', 'Ihre SEPA-Gläubiger-Identifikationsnummer', 30),
('sepa_bankname', '', 'text', 'zahlungen', 'Bank Name', 'Name der Bank für SEPA', 40),
('sepa_iban', '', 'text', 'zahlungen', 'IBAN', 'IBAN für SEPA-Einzüge', 50),
('sepa_bic', '', 'text', 'zahlungen', 'BIC', 'BIC der Bank', 60),

-- Mitgliedsnummern
('mitgliedsnummer_prefix_dojo', 'TDA-D', 'text', 'nummern', 'Prefix Dojo-Mitgliedsnummer', 'Präfix für Dojo-Mitgliedsnummern', 10),
('mitgliedsnummer_prefix_einzel', 'TDA-E', 'text', 'nummern', 'Prefix Einzelmitgliedsnummer', 'Präfix für Einzelmitgliedsnummern', 20),
('naechste_dojo_nummer', '1', 'number', 'nummern', 'Nächste Dojo-Nummer', 'Nächste zu vergebende Dojo-Nummer', 30),
('naechste_einzel_nummer', '1', 'number', 'nummern', 'Nächste Einzelmitglieds-Nummer', 'Nächste zu vergebende Einzelmitglieds-Nummer', 40),

-- Verband Info
('verband_name', 'Tiger & Dragon Association International', 'text', 'verband', 'Verbandsname', 'Offizieller Name des Verbands', 10),
('verband_kurzname', 'TDA Int\'l', 'text', 'verband', 'Kurzname', 'Abkürzung des Verbands', 20),
('verband_strasse', '', 'text', 'verband', 'Straße', 'Adresse des Verbands', 30),
('verband_plz', '', 'text', 'verband', 'PLZ', 'Postleitzahl', 40),
('verband_ort', '', 'text', 'verband', 'Ort', 'Stadt', 50),
('verband_land', 'Deutschland', 'text', 'verband', 'Land', 'Land', 60),
('verband_email', '', 'text', 'verband', 'E-Mail', 'Kontakt-E-Mail', 70),
('verband_telefon', '', 'text', 'verband', 'Telefon', 'Kontakt-Telefon', 80),
('verband_website', '', 'text', 'verband', 'Website', 'Website-URL', 90),
('verband_steuernummer', '', 'text', 'verband', 'Steuernummer', 'Steuernummer des Verbands', 100),
('verband_ustid', '', 'text', 'verband', 'USt-IdNr.', 'Umsatzsteuer-ID', 110);

-- Index
CREATE INDEX idx_verband_einstellungen_kategorie ON verband_einstellungen(kategorie);
CREATE INDEX idx_verband_einstellungen_key ON verband_einstellungen(einstellung_key);
