const db = require('./db');
const fs = require('fs');

console.log('📋 Creating Personal Table...');

// SQL für Personal-Tabelle
const personalTableSQL = `
CREATE TABLE IF NOT EXISTS personal (
    personal_id INT AUTO_INCREMENT PRIMARY KEY,
    personalnummer VARCHAR(20) UNIQUE NOT NULL,
    
    -- Persönliche Daten
    vorname VARCHAR(100) NOT NULL,
    nachname VARCHAR(100) NOT NULL,
    titel VARCHAR(50) NULL,
    geburtsdatum DATE NULL,
    geschlecht ENUM('m', 'w', 'd') NULL,
    
    -- Kontaktdaten
    email VARCHAR(255) UNIQUE NULL,
    telefon VARCHAR(50) NULL,
    handy VARCHAR(50) NULL,
    
    -- Adresse
    strasse VARCHAR(255) NULL,
    hausnummer VARCHAR(20) NULL,
    plz VARCHAR(10) NULL,
    ort VARCHAR(100) NULL,
    land VARCHAR(100) DEFAULT 'Deutschland',
    
    -- Anstellung
    position VARCHAR(100) NOT NULL,
    abteilung VARCHAR(100) NULL,
    einstellungsdatum DATE NOT NULL,
    kuendigungsdatum DATE NULL,
    beschaeftigungsart ENUM('Vollzeit', 'Teilzeit', 'Minijob', 'Praktikant', 'Freelancer') NOT NULL,
    arbeitszeit_stunden DECIMAL(4,2) NULL,
    
    -- Gehalt/Verdienst
    grundgehalt DECIMAL(10,2) NULL,
    stundenlohn DECIMAL(6,2) NULL,
    waehrung VARCHAR(3) DEFAULT 'EUR',
    
    -- Qualifikationen
    ausbildung VARCHAR(500) NULL,
    zertifikate TEXT NULL,
    kampfkunst_graduierung VARCHAR(100) NULL,
    
    -- Arbeitserlaubnis/Dokumente
    staatsangehoerigkeit VARCHAR(100) NULL,
    arbeitserlaubnis TINYINT(1) DEFAULT 1,
    sozialversicherungsnummer VARCHAR(50) NULL,
    steuerklasse ENUM('I', 'II', 'III', 'IV', 'V', 'VI') NULL,
    
    -- Bankdaten
    iban VARCHAR(50) NULL,
    bic VARCHAR(20) NULL,
    bank_name VARCHAR(255) NULL,
    
    -- Status und Metadaten
    status ENUM('aktiv', 'inaktiv', 'gekuendigt', 'beurlaubt') DEFAULT 'aktiv',
    notizen TEXT NULL,
    foto_pfad VARCHAR(500) NULL,
    
    -- Zeitstempel
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    erstellt_von INT NULL,
    
    INDEX idx_personalnummer (personalnummer),
    INDEX idx_name (nachname, vorname),
    INDEX idx_email (email),
    INDEX idx_position (position),
    INDEX idx_status (status),
    INDEX idx_einstellungsdatum (einstellungsdatum)
)`;

const berechtigungenTableSQL = `
CREATE TABLE IF NOT EXISTS personal_berechtigungen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    personal_id INT NOT NULL,
    berechtigung VARCHAR(100) NOT NULL,
    erteilt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    erteilt_von INT NULL,
    
    FOREIGN KEY (personal_id) REFERENCES personal(personal_id) ON DELETE CASCADE,
    UNIQUE KEY unique_permission (personal_id, berechtigung),
    INDEX idx_berechtigung (berechtigung)
)`;

const arbeitszeitTableSQL = `
CREATE TABLE IF NOT EXISTS personal_arbeitszeit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    personal_id INT NOT NULL,
    datum DATE NOT NULL,
    start_zeit TIME NOT NULL,
    end_zeit TIME NULL,
    pause_minuten INT DEFAULT 0,
    stunden_gesamt DECIMAL(4,2) NULL,
    notizen VARCHAR(500) NULL,
    
    FOREIGN KEY (personal_id) REFERENCES personal(personal_id) ON DELETE CASCADE,
    INDEX idx_personal_datum (personal_id, datum),
    INDEX idx_datum (datum)
)`;

const urlaubTableSQL = `
CREATE TABLE IF NOT EXISTS personal_urlaub (
    id INT AUTO_INCREMENT PRIMARY KEY,
    personal_id INT NOT NULL,
    typ ENUM('Urlaub', 'Krankheit', 'Fortbildung', 'Sonderurlaub', 'Unbezahlt') NOT NULL,
    start_datum DATE NOT NULL,
    end_datum DATE NOT NULL,
    tage_gesamt INT NULL,
    grund VARCHAR(255) NULL,
    status ENUM('beantragt', 'genehmigt', 'abgelehnt', 'storniert') DEFAULT 'beantragt',
    genehmigt_von INT NULL,
    genehmigt_am TIMESTAMP NULL,
    
    FOREIGN KEY (personal_id) REFERENCES personal(personal_id) ON DELETE CASCADE,
    INDEX idx_personal_datum (personal_id, start_datum),
    INDEX idx_status (status)
)`;

// Beispiel-Daten
const sampleDataSQL = `
INSERT IGNORE INTO personal (
    personalnummer, vorname, nachname, position, beschaeftigungsart, 
    einstellungsdatum, email, telefon, grundgehalt
) VALUES 
('MA001', 'Max', 'Mustermann', 'Dojo-Leiter', 'Vollzeit', '2020-01-15', 'max.mustermann@dojo.local', '+49 123 456789', 3500.00),
('MA002', 'Anna', 'Schmidt', 'Trainer', 'Teilzeit', '2021-03-01', 'anna.schmidt@dojo.local', '+49 123 456790', 2200.00),
('MA003', 'Peter', 'Wagner', 'Rezeption', 'Vollzeit', '2022-06-01', 'peter.wagner@dojo.local', '+49 123 456791', 2800.00)
`;

// Tabellen nacheinander erstellen
async function createTables() {
    try {
        console.log('✅ Creating personal table...');
        await new Promise((resolve, reject) => {
            db.query(personalTableSQL, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        console.log('✅ Creating personal_berechtigungen table...');
        await new Promise((resolve, reject) => {
            db.query(berechtigungenTableSQL, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        console.log('✅ Creating personal_arbeitszeit table...');
        await new Promise((resolve, reject) => {
            db.query(arbeitszeitTableSQL, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        console.log('✅ Creating personal_urlaub table...');
        await new Promise((resolve, reject) => {
            db.query(urlaubTableSQL, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        console.log('✅ Inserting sample data...');
        await new Promise((resolve, reject) => {
            db.query(sampleDataSQL, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        console.log('🎉 Personal tables created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        process.exit(1);
    }
}

createTables();