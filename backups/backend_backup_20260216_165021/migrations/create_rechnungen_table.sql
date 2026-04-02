-- Tabelle für Rechnungen erstellen
CREATE TABLE IF NOT EXISTS rechnungen (
    rechnung_id INT AUTO_INCREMENT PRIMARY KEY,
    rechnungsnummer VARCHAR(50) NOT NULL UNIQUE,
    mitglied_id INT NOT NULL,
    datum DATE NOT NULL,
    faelligkeitsdatum DATE NOT NULL,
    betrag DECIMAL(10, 2) NOT NULL,
    netto_betrag DECIMAL(10, 2),
    brutto_betrag DECIMAL(10, 2),
    mwst_satz DECIMAL(5, 2) DEFAULT 19.00,
    mwst_betrag DECIMAL(10, 2),
    status ENUM('offen', 'teilweise_bezahlt', 'bezahlt', 'ueberfaellig', 'storniert') DEFAULT 'offen',
    bezahlt_am DATE NULL,
    zahlungsart ENUM('bar', 'ueberweisung', 'lastschrift', 'kreditkarte', 'paypal') NULL,
    art ENUM('mitgliedsbeitrag', 'pruefungsgebuehr', 'kursgebuehr', 'ausruestung', 'sonstiges') NOT NULL,
    beschreibung TEXT,
    notizen TEXT,
    archiviert TINYINT(1) DEFAULT 0,
    pdf_pfad VARCHAR(500),
    dojo_id INT DEFAULT 1,
    erstellt_von INT,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
    INDEX idx_mitglied (mitglied_id),
    INDEX idx_status (status),
    INDEX idx_datum (datum),
    INDEX idx_faelligkeit (faelligkeitsdatum),
    INDEX idx_dojo (dojo_id),
    INDEX idx_rechnungsnummer (rechnungsnummer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Rechnungspositionen erstellen
CREATE TABLE IF NOT EXISTS rechnungspositionen (
    position_id INT AUTO_INCREMENT PRIMARY KEY,
    rechnung_id INT NOT NULL,
    position_nr INT NOT NULL,
    bezeichnung VARCHAR(255) NOT NULL,
    menge DECIMAL(10, 2) DEFAULT 1.00,
    einzelpreis DECIMAL(10, 2) NOT NULL,
    gesamtpreis DECIMAL(10, 2) NOT NULL,
    mwst_satz DECIMAL(5, 2) DEFAULT 19.00,
    beschreibung TEXT,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rechnung_id) REFERENCES rechnungen(rechnung_id) ON DELETE CASCADE,
    INDEX idx_rechnung (rechnung_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Zahlungen/Teilzahlungen
CREATE TABLE IF NOT EXISTS zahlungen (
    zahlung_id INT AUTO_INCREMENT PRIMARY KEY,
    rechnung_id INT NOT NULL,
    betrag DECIMAL(10, 2) NOT NULL,
    zahlungsdatum DATE NOT NULL,
    zahlungsart ENUM('bar', 'ueberweisung', 'lastschrift', 'kreditkarte', 'paypal') NOT NULL,
    referenz VARCHAR(255),
    notizen TEXT,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rechnung_id) REFERENCES rechnungen(rechnung_id) ON DELETE CASCADE,
    INDEX idx_rechnung (rechnung_id),
    INDEX idx_datum (zahlungsdatum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
