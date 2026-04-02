-- =====================================================================================
-- ARTIKEL BESTELLUNGEN SYSTEM
-- Migration: 050_artikel_bestellungen.sql
-- =====================================================================================
-- Bestellsystem für Artikel beim Lieferanten
-- Inklusive PDF-Generierung für pakistanischen Hersteller (in Englisch)
-- =====================================================================================

-- Haupttabelle für Bestellungen
CREATE TABLE IF NOT EXISTS artikel_bestellungen (
    bestellung_id INT AUTO_INCREMENT PRIMARY KEY,

    -- Bestellnummer (z.B. ORD-2026-0001)
    bestellnummer VARCHAR(50) NOT NULL UNIQUE,

    -- Organisation
    dojo_id INT NOT NULL,

    -- Lieferant-Informationen
    lieferant_name VARCHAR(255),
    lieferant_land VARCHAR(100) DEFAULT 'Pakistan',
    lieferant_email VARCHAR(255),
    lieferant_telefon VARCHAR(100),

    -- Status
    status ENUM('entwurf', 'gesendet', 'bestaetigt', 'versendet', 'geliefert', 'storniert') DEFAULT 'entwurf',

    -- Beträge (in Cent für Genauigkeit)
    gesamtbetrag_cent INT DEFAULT 0,
    waehrung VARCHAR(3) DEFAULT 'EUR',

    -- Bemerkungen
    bemerkungen TEXT,
    interne_notizen TEXT,

    -- PDF-Speicherung
    pdf_generiert_am TIMESTAMP NULL,
    pdf_pfad VARCHAR(500),

    -- Audit
    erstellt_von INT,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    gesendet_am TIMESTAMP NULL,
    geliefert_am TIMESTAMP NULL,

    INDEX idx_dojo (dojo_id),
    INDEX idx_status (status),
    INDEX idx_bestellnummer (bestellnummer),
    INDEX idx_erstellt (erstellt_am)
);

-- Positionen (Artikel + Größen + Mengen)
CREATE TABLE IF NOT EXISTS artikel_bestellung_positionen (
    position_id INT AUTO_INCREMENT PRIMARY KEY,

    bestellung_id INT NOT NULL,
    artikel_id INT NOT NULL,

    -- Größen-Mengen als JSON: {"S": 5, "M": 10, "L": 8, ...}
    groessen_mengen JSON NOT NULL,

    -- Gesamtmenge (automatisch aus groessen_mengen berechnet)
    gesamt_menge INT DEFAULT 0,

    -- Preis pro Stück (in Cent)
    stueckpreis_cent INT DEFAULT 0,

    -- Positions-Gesamtpreis (stueckpreis_cent * gesamt_menge)
    positions_preis_cent INT DEFAULT 0,

    -- Bemerkung zur Position
    bemerkung VARCHAR(500),

    -- Reihenfolge in der Bestellung
    sortierung INT DEFAULT 0,

    INDEX idx_bestellung (bestellung_id),
    INDEX idx_artikel (artikel_id),

    FOREIGN KEY (bestellung_id) REFERENCES artikel_bestellungen(bestellung_id) ON DELETE CASCADE
);

-- Bestellhistorie / Aktivitäten-Log
CREATE TABLE IF NOT EXISTS artikel_bestellung_historie (
    historie_id INT AUTO_INCREMENT PRIMARY KEY,

    bestellung_id INT NOT NULL,

    -- Aktion
    aktion ENUM('erstellt', 'bearbeitet', 'pdf_generiert', 'gesendet', 'bestaetigt', 'versendet', 'geliefert', 'storniert') NOT NULL,

    -- Details als JSON (z.B. geänderte Felder)
    details JSON,

    -- Wer hat's gemacht
    benutzer_id INT,
    benutzer_name VARCHAR(100),

    -- Wann
    zeitstempel TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_bestellung (bestellung_id),
    INDEX idx_zeitstempel (zeitstempel),

    FOREIGN KEY (bestellung_id) REFERENCES artikel_bestellungen(bestellung_id) ON DELETE CASCADE
);

-- View für niedrigen Bestand (< 2 Stück pro Größe)
CREATE OR REPLACE VIEW v_artikel_niedriger_bestand AS
SELECT
    a.artikel_id,
    a.name AS artikel_name,
    a.artikel_nummer,
    a.lagerbestand,
    a.mindestbestand,
    a.varianten_bestand,
    a.varianten_groessen,
    a.groessen_kids,
    a.groessen_erwachsene,
    a.hat_varianten,
    a.hat_preiskategorien,
    a.einkaufspreis_cent,
    a.dojo_id,
    ag.name AS artikelgruppe_name
FROM artikel a
LEFT JOIN artikelgruppen ag ON a.artikelgruppe_id = ag.id
WHERE a.aktiv = TRUE
  AND a.lager_tracking = TRUE
  AND (
    -- Entweder Gesamtbestand < 2
    a.lagerbestand < 2
    -- Oder bei Varianten prüfen wir später im Backend die einzelnen Größen
    OR a.hat_varianten = TRUE
  );

-- Trigger zur automatischen Berechnung der Gesamtmenge
DELIMITER //
CREATE TRIGGER IF NOT EXISTS tr_bestellung_position_before_insert
BEFORE INSERT ON artikel_bestellung_positionen
FOR EACH ROW
BEGIN
    DECLARE total INT DEFAULT 0;

    -- Gesamtmenge aus JSON berechnen
    SET total = (
        SELECT COALESCE(SUM(jt.qty), 0)
        FROM JSON_TABLE(
            NEW.groessen_mengen,
            '$.*' COLUMNS (qty INT PATH '$')
        ) AS jt
    );

    SET NEW.gesamt_menge = total;
    SET NEW.positions_preis_cent = NEW.stueckpreis_cent * total;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER IF NOT EXISTS tr_bestellung_position_before_update
BEFORE UPDATE ON artikel_bestellung_positionen
FOR EACH ROW
BEGIN
    DECLARE total INT DEFAULT 0;

    -- Gesamtmenge aus JSON berechnen
    SET total = (
        SELECT COALESCE(SUM(jt.qty), 0)
        FROM JSON_TABLE(
            NEW.groessen_mengen,
            '$.*' COLUMNS (qty INT PATH '$')
        ) AS jt
    );

    SET NEW.gesamt_menge = total;
    SET NEW.positions_preis_cent = NEW.stueckpreis_cent * total;
END//
DELIMITER ;

-- Trigger für Bestellnummer-Generierung
DELIMITER //
CREATE TRIGGER IF NOT EXISTS tr_bestellung_before_insert
BEFORE INSERT ON artikel_bestellungen
FOR EACH ROW
BEGIN
    DECLARE next_number INT;
    DECLARE current_year CHAR(4);

    -- Aktuelles Jahr
    SET current_year = YEAR(CURRENT_DATE);

    -- Nächste Nummer für dieses Jahr
    SELECT COALESCE(MAX(
        CAST(SUBSTRING_INDEX(bestellnummer, '-', -1) AS UNSIGNED)
    ), 0) + 1 INTO next_number
    FROM artikel_bestellungen
    WHERE bestellnummer LIKE CONCAT('ORD-', current_year, '-%');

    -- Bestellnummer setzen falls leer
    IF NEW.bestellnummer IS NULL OR NEW.bestellnummer = '' THEN
        SET NEW.bestellnummer = CONCAT('ORD-', current_year, '-', LPAD(next_number, 4, '0'));
    END IF;
END//
DELIMITER ;

-- Trigger zur Aktualisierung des Gesamtbetrags
DELIMITER //
CREATE TRIGGER IF NOT EXISTS tr_bestellung_position_after_change
AFTER INSERT ON artikel_bestellung_positionen
FOR EACH ROW
BEGIN
    UPDATE artikel_bestellungen
    SET gesamtbetrag_cent = (
        SELECT COALESCE(SUM(positions_preis_cent), 0)
        FROM artikel_bestellung_positionen
        WHERE bestellung_id = NEW.bestellung_id
    )
    WHERE bestellung_id = NEW.bestellung_id;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER IF NOT EXISTS tr_bestellung_position_after_update
AFTER UPDATE ON artikel_bestellung_positionen
FOR EACH ROW
BEGIN
    UPDATE artikel_bestellungen
    SET gesamtbetrag_cent = (
        SELECT COALESCE(SUM(positions_preis_cent), 0)
        FROM artikel_bestellung_positionen
        WHERE bestellung_id = NEW.bestellung_id
    )
    WHERE bestellung_id = NEW.bestellung_id;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER IF NOT EXISTS tr_bestellung_position_after_delete
AFTER DELETE ON artikel_bestellung_positionen
FOR EACH ROW
BEGIN
    UPDATE artikel_bestellungen
    SET gesamtbetrag_cent = (
        SELECT COALESCE(SUM(positions_preis_cent), 0)
        FROM artikel_bestellung_positionen
        WHERE bestellung_id = OLD.bestellung_id
    )
    WHERE bestellung_id = OLD.bestellung_id;
END//
DELIMITER ;
