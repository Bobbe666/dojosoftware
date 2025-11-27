-- =====================================================================================
-- VERKAUFSSYSTEM FÜR DOJOSOFTWARE - DATENBANK TABELLEN
-- =====================================================================================
-- Deutsche rechtliche Grundlagen für Barverkäufe beachtet (GoBD, KassenSichV, TSE)
-- Erstellt: $(date)
-- =====================================================================================

-- 1. ARTIKEL-KATEGORIEN
-- =====================================================================================
CREATE TABLE IF NOT EXISTS artikel_kategorien (
  kategorie_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  beschreibung TEXT,
  farbe_hex VARCHAR(7) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT 'package',
  aktiv BOOLEAN DEFAULT TRUE,
  reihenfolge INT DEFAULT 0,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Standard-Kategorien einfügen
INSERT IGNORE INTO artikel_kategorien (name, beschreibung, farbe_hex, icon, reihenfolge) VALUES
('Getränke', 'Erfrischungsgetränke, Wasser, Energydrinks', '#10B981', 'coffee', 1),
('Snacks', 'Riegel, Nüsse, gesunde Snacks', '#F59E0B', 'cookie', 2),
('Equipment', 'Trainingsausrüstung, Zubehör', '#EF4444', 'dumbbell', 3),
('Bekleidung', 'Trainingskleidung, T-Shirts, Hosen', '#8B5CF6', 'shirt', 4),
('Nahrungsergänzung', 'Proteine, Vitamine, Supplements', '#06B6D4', 'pill', 5),
('Sonstiges', 'Verschiedene Artikel', '#6B7280', 'more-horizontal', 6);

-- =====================================================================================
-- 2. ARTIKEL
-- =====================================================================================
CREATE TABLE IF NOT EXISTS artikel (
  artikel_id INT AUTO_INCREMENT PRIMARY KEY,
  kategorie_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  beschreibung TEXT,
  ean_code VARCHAR(50), -- EAN/GTIN für Barcode-Scanner
  artikel_nummer VARCHAR(50) UNIQUE,
  
  -- Preise (alle in Euro-Cent für präzise Berechnung)
  einkaufspreis_cent INT DEFAULT 0,
  verkaufspreis_cent INT NOT NULL,
  mwst_prozent DECIMAL(5,2) NOT NULL DEFAULT 19.00, -- Deutsche MwSt-Sätze: 19%, 7%
  
  -- Lagerbestand
  lagerbestand INT DEFAULT 0,
  mindestbestand INT DEFAULT 0,
  lager_tracking BOOLEAN DEFAULT TRUE,
  
  -- Darstellung
  bild_url VARCHAR(500),
  bild_base64 LONGTEXT, -- Für offline-Verfügbarkeit
  farbe_hex VARCHAR(7) DEFAULT '#FFFFFF',
  
  -- Status
  aktiv BOOLEAN DEFAULT TRUE,
  sichtbar_kasse BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (kategorie_id) REFERENCES artikel_kategorien(kategorie_id) ON DELETE CASCADE,
  
  -- Indizes
  INDEX idx_kategorie (kategorie_id),
  INDEX idx_aktiv (aktiv),
  INDEX idx_ean (ean_code),
  INDEX idx_artikel_nummer (artikel_nummer)
);

-- =====================================================================================
-- 3. VERKÄUFE (Kassenbons)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS verkaeufe (
  verkauf_id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Kassenbon-Informationen (GoBD-konform)
  bon_nummer VARCHAR(50) NOT NULL UNIQUE, -- Fortlaufende Bonnummer
  kassen_id VARCHAR(50) NOT NULL DEFAULT 'KASSE_01', -- Kassen-Identifikation
  
  -- Kunde (optional für Barverkäufe)
  mitglied_id INT NULL, -- Referenz zu Mitglied, NULL für Laufkundschaft
  kunde_name VARCHAR(200), -- Name bei Laufkundschaft
  
  -- Zeitstempel (rechtlich erforderlich)
  verkauf_datum DATE NOT NULL,
  verkauf_uhrzeit TIME NOT NULL,
  verkauf_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Beträge (in Euro-Cent)
  netto_gesamt_cent INT NOT NULL DEFAULT 0,
  mwst_gesamt_cent INT NOT NULL DEFAULT 0,
  brutto_gesamt_cent INT NOT NULL DEFAULT 0,
  
  -- Zahlungsart
  zahlungsart ENUM('bar', 'karte', 'digital', 'gutschein') NOT NULL DEFAULT 'bar',
  gegeben_cent INT, -- Bei Barzahlung: gegebener Betrag
  rueckgeld_cent INT, -- Berechnetes Rückgeld
  
  -- Personal
  verkauft_von INT, -- User-ID des Verkäufers
  verkauft_von_name VARCHAR(100),
  
  -- TSE-Daten (für Kassensicherungsverordnung)
  tse_signatur TEXT, -- TSE-Signatur (wenn implementiert)
  tse_zeitstempel TIMESTAMP NULL,
  tse_transaction_id VARCHAR(100),
  
  -- Status
  storniert BOOLEAN DEFAULT FALSE,
  storno_grund TEXT,
  storno_timestamp TIMESTAMP NULL,
  
  -- Zusätzliche Informationen
  bemerkung TEXT,
  
  -- Foreign Keys
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE SET NULL,
  
  -- Indizes
  INDEX idx_bon_nummer (bon_nummer),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_datum (verkauf_datum),
  INDEX idx_timestamp (verkauf_timestamp),
  INDEX idx_kasse (kassen_id)
);

-- =====================================================================================
-- 4. VERKAUFS-POSITIONEN
-- =====================================================================================
CREATE TABLE IF NOT EXISTS verkauf_positionen (
  position_id INT AUTO_INCREMENT PRIMARY KEY,
  verkauf_id INT NOT NULL,
  artikel_id INT NOT NULL,
  
  -- Artikel-Daten zum Verkaufszeitpunkt (historische Daten)
  artikel_name VARCHAR(200) NOT NULL,
  artikel_nummer VARCHAR(50),
  
  -- Mengen und Preise
  menge INT NOT NULL DEFAULT 1,
  einzelpreis_cent INT NOT NULL, -- Preis zum Verkaufszeitpunkt
  mwst_prozent DECIMAL(5,2) NOT NULL,
  
  -- Berechnete Werte
  netto_cent INT NOT NULL,
  mwst_cent INT NOT NULL,
  brutto_cent INT NOT NULL,
  
  -- Position im Bon
  position_nummer INT NOT NULL DEFAULT 1,
  
  -- Foreign Keys
  FOREIGN KEY (verkauf_id) REFERENCES verkaeufe(verkauf_id) ON DELETE CASCADE,
  FOREIGN KEY (artikel_id) REFERENCES artikel(artikel_id) ON DELETE RESTRICT,
  
  -- Indizes
  INDEX idx_verkauf (verkauf_id),
  INDEX idx_artikel (artikel_id)
);

-- =====================================================================================
-- 5. LAGER-BEWEGUNGEN
-- =====================================================================================
CREATE TABLE IF NOT EXISTS lager_bewegungen (
  bewegung_id INT AUTO_INCREMENT PRIMARY KEY,
  artikel_id INT NOT NULL,
  
  -- Bewegungsart
  bewegungsart ENUM('eingang', 'ausgang', 'korrektur', 'inventur') NOT NULL,
  menge INT NOT NULL, -- Positiv für Eingang, Negativ für Ausgang
  alter_bestand INT NOT NULL,
  neuer_bestand INT NOT NULL,
  
  -- Grund/Referenz
  grund VARCHAR(200),
  verkauf_id INT NULL, -- Referenz bei Verkäufen
  referenz_nummer VARCHAR(100),
  
  -- Wer/Wann
  durchgefuehrt_von INT,
  durchgefuehrt_von_name VARCHAR(100),
  bewegung_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (artikel_id) REFERENCES artikel(artikel_id) ON DELETE CASCADE,
  FOREIGN KEY (verkauf_id) REFERENCES verkaeufe(verkauf_id) ON DELETE SET NULL,
  
  -- Indizes
  INDEX idx_artikel (artikel_id),
  INDEX idx_bewegungsart (bewegungsart),
  INDEX idx_timestamp (bewegung_timestamp)
);

-- =====================================================================================
-- 6. MWST-SÄTZE (für deutsche Rechtslage)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS mwst_saetze (
  mwst_id INT AUTO_INCREMENT PRIMARY KEY,
  bezeichnung VARCHAR(100) NOT NULL,
  prozent DECIMAL(5,2) NOT NULL,
  gueltig_von DATE NOT NULL,
  gueltig_bis DATE NULL,
  aktiv BOOLEAN DEFAULT TRUE,
  
  UNIQUE KEY unique_aktiv_prozent (prozent, aktiv)
);

-- Deutsche MwSt-Sätze einfügen
INSERT IGNORE INTO mwst_saetze (bezeichnung, prozent, gueltig_von, aktiv) VALUES
('Normaler Steuersatz', 19.00, '2007-01-01', TRUE),
('Ermäßigter Steuersatz', 7.00, '2007-01-01', TRUE),
('Steuerfrei', 0.00, '2007-01-01', TRUE);

-- =====================================================================================
-- 7. KASSENBUCH (für Barverkäufe - GoBD)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS kassenbuch (
  eintrag_id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Datum und Uhrzeit
  geschaeft_datum DATE NOT NULL,
  eintrag_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Kassenbewegung
  bewegungsart ENUM('einnahme', 'ausgabe', 'entnahme', 'einlage', 'tagesabschluss') NOT NULL,
  betrag_cent INT NOT NULL,
  
  -- Beschreibung
  beschreibung TEXT NOT NULL,
  verkauf_id INT NULL, -- Referenz zu Verkauf wenn zutreffend
  beleg_nummer VARCHAR(100),
  
  -- Kassenstand
  kassenstand_vorher_cent INT NOT NULL,
  kassenstand_nachher_cent INT NOT NULL,
  
  -- Personal
  erfasst_von INT,
  erfasst_von_name VARCHAR(100),
  
  -- Foreign Keys
  FOREIGN KEY (verkauf_id) REFERENCES verkaeufe(verkauf_id) ON DELETE SET NULL,
  
  -- Indizes
  INDEX idx_datum (geschaeft_datum),
  INDEX idx_bewegungsart (bewegungsart)
);

-- =====================================================================================
-- 8. DEMO-ARTIKEL EINFÜGEN
-- =====================================================================================

-- Getränke
INSERT IGNORE INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, artikel_nummer, bild_url) VALUES
(1, 'Wasser 0,5L', 'Stilles Mineralwasser', 150, 19.00, 50, 'GET001', NULL),
(1, 'Apfelschorle 0,5L', 'Erfrischende Apfelschorle', 200, 19.00, 30, 'GET002', NULL),
(1, 'Energy Drink', 'Koffeingetränk für mehr Energie', 250, 19.00, 25, 'GET003', NULL),
(1, 'Proteinshake', 'Fertig gemischter Proteinshake', 350, 19.00, 20, 'GET004', NULL);

-- Snacks
INSERT IGNORE INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, artikel_nummer, bild_url) VALUES
(2, 'Proteinriegel', 'High-Protein Riegel 50g', 280, 7.00, 40, 'SNA001', NULL),
(2, 'Nussmischung', 'Gesunde Nuss-Mix 100g', 320, 7.00, 35, 'SNA002', NULL),
(2, 'Banane', 'Frische Banane', 80, 7.00, 0, 'SNA003', NULL);

-- Equipment
INSERT IGNORE INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, artikel_nummer, bild_url) VALUES
(3, 'Handtuch', 'Mikrofaser Handtuch 80x40cm', 1200, 19.00, 15, 'EQU001', NULL),
(3, 'Trinkflasche', 'Sport-Trinkflasche 750ml', 800, 19.00, 25, 'EQU002', NULL),
(3, 'Springseil', 'Verstellbares Fitness-Springseil', 1500, 19.00, 10, 'EQU003', NULL);

-- Bekleidung
INSERT IGNORE INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, artikel_nummer, bild_url) VALUES
(4, 'Dojo T-Shirt', 'Logo T-Shirt Baumwolle', 2500, 19.00, 20, 'BEK001', NULL),
(4, 'Trainingshose', 'Bequeme Trainingshose', 3500, 19.00, 15, 'BEK002', NULL);

-- Nahrungsergänzung
INSERT IGNORE INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, artikel_nummer, bild_url) VALUES
(5, 'Whey Protein', 'Proteinpulver 1kg Dose', 4500, 19.00, 8, 'NAH001', NULL),
(5, 'Creatin', 'Creatin Monohydrat 300g', 2800, 19.00, 12, 'NAH002', NULL);

-- =====================================================================================
-- 9. TRIGGER FÜR LAGERBESTAND
-- =====================================================================================

DELIMITER //

-- Trigger für Lagerbestand-Update bei Verkauf
CREATE TRIGGER verkauf_lager_update
AFTER INSERT ON verkauf_positionen
FOR EACH ROW
BEGIN
    DECLARE alter_bestand INT;
    DECLARE neuer_bestand INT;
    
    -- Aktuellen Bestand abfragen
    SELECT lagerbestand INTO alter_bestand 
    FROM artikel 
    WHERE artikel_id = NEW.artikel_id;
    
    -- Neuen Bestand berechnen
    SET neuer_bestand = alter_bestand - NEW.menge;
    
    -- Artikel-Lagerbestand aktualisieren (nur wenn Lager-Tracking aktiv)
    UPDATE artikel 
    SET lagerbestand = neuer_bestand
    WHERE artikel_id = NEW.artikel_id AND lager_tracking = TRUE;
    
    -- Lagerbewegung protokollieren
    INSERT INTO lager_bewegungen (
        artikel_id, 
        bewegungsart, 
        menge, 
        alter_bestand, 
        neuer_bestand, 
        grund, 
        verkauf_id,
        bewegung_timestamp
    ) VALUES (
        NEW.artikel_id,
        'ausgang',
        -NEW.menge, -- Negativ für Ausgang
        alter_bestand,
        neuer_bestand,
        CONCAT('Verkauf - Bon: ', (SELECT bon_nummer FROM verkaeufe WHERE verkauf_id = NEW.verkauf_id)),
        NEW.verkauf_id,
        NOW()
    );
END//

DELIMITER ;

-- =====================================================================================
-- 10. VIEWS FÜR REPORTING
-- =====================================================================================

-- Tagesumsatz-View
CREATE OR REPLACE VIEW tagesumsatz AS
SELECT 
    verkauf_datum,
    COUNT(*) as anzahl_verkaeufe,
    SUM(brutto_gesamt_cent) as umsatz_cent,
    ROUND(SUM(brutto_gesamt_cent) / 100, 2) as umsatz_euro,
    SUM(CASE WHEN zahlungsart = 'bar' THEN brutto_gesamt_cent ELSE 0 END) as bar_umsatz_cent,
    SUM(CASE WHEN zahlungsart = 'karte' THEN brutto_gesamt_cent ELSE 0 END) as karte_umsatz_cent
FROM verkaeufe
WHERE storniert = FALSE
GROUP BY verkauf_datum
ORDER BY verkauf_datum DESC;

-- Artikel-Umsatz-View  
CREATE OR REPLACE VIEW artikel_umsatz AS
SELECT 
    a.artikel_id,
    a.name,
    ak.name as kategorie,
    SUM(vp.menge) as verkaufte_menge,
    SUM(vp.brutto_cent) as umsatz_cent,
    ROUND(SUM(vp.brutto_cent) / 100, 2) as umsatz_euro,
    a.lagerbestand,
    CASE 
        WHEN a.lagerbestand <= a.mindestbestand THEN 'Nachbestellen'
        WHEN a.lagerbestand = 0 THEN 'Ausverkauft'
        ELSE 'Verfügbar'
    END as lager_status
FROM artikel a
JOIN artikel_kategorien ak ON a.kategorie_id = ak.kategorie_id
LEFT JOIN verkauf_positionen vp ON a.artikel_id = vp.artikel_id
LEFT JOIN verkaeufe v ON vp.verkauf_id = v.verkauf_id AND v.storniert = FALSE
WHERE a.aktiv = TRUE
GROUP BY a.artikel_id, a.name, ak.name, a.lagerbestand, a.mindestbestand
ORDER BY umsatz_euro DESC;

-- =====================================================================================
-- TABELLEN ERFOLGREICH ERSTELLT
-- =====================================================================================

SELECT 'Verkaufssystem-Tabellen erfolgreich erstellt!' as Status;