-- Migration: Automatisches Lastschrift-System
-- Erstellt: 2026-02-09
-- Beschreibung: Tabellen für automatische Lastschriftläufe mit Zeitplänen

-- ============================================
-- 1. Zeitpläne für automatische Lastschriftläufe
-- ============================================
CREATE TABLE IF NOT EXISTS lastschrift_zeitplaene (
    zeitplan_id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,

    -- Identifikation
    name VARCHAR(100) NOT NULL,
    beschreibung TEXT,

    -- Zeitplan
    ausfuehrungstag INT NOT NULL CHECK (ausfuehrungstag BETWEEN 1 AND 28),
    ausfuehrungszeit TIME DEFAULT '06:00:00',

    -- Was wird eingezogen?
    typ ENUM('beitraege', 'rechnungen', 'verkaeufe', 'alle') NOT NULL DEFAULT 'beitraege',

    -- Filter
    nur_faellige_bis_tag INT DEFAULT NULL,
    zahlungszyklus_filter JSON DEFAULT NULL,

    -- Status
    aktiv BOOLEAN DEFAULT TRUE,

    -- Letzte Ausführung
    letzte_ausfuehrung TIMESTAMP NULL,
    letzte_ausfuehrung_status ENUM('erfolg', 'teilweise', 'fehler') NULL,
    letzte_ausfuehrung_anzahl INT DEFAULT 0,
    letzte_ausfuehrung_betrag DECIMAL(10,2) DEFAULT 0.00,

    -- Audit
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_zeitplan_dojo (dojo_id),
    INDEX idx_zeitplan_aktiv (aktiv),
    INDEX idx_zeitplan_tag (ausfuehrungstag),
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
);

-- ============================================
-- 2. Log aller automatischen Läufe
-- ============================================
CREATE TABLE IF NOT EXISTS lastschrift_ausfuehrungen (
    ausfuehrung_id INT AUTO_INCREMENT PRIMARY KEY,
    zeitplan_id INT NOT NULL,
    dojo_id INT NOT NULL,

    -- Zeitpunkt
    gestartet_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    beendet_am TIMESTAMP NULL,

    -- Ergebnis
    status ENUM('gestartet', 'erfolg', 'teilweise', 'fehler', 'abgebrochen') DEFAULT 'gestartet',
    anzahl_verarbeitet INT DEFAULT 0,
    anzahl_erfolgreich INT DEFAULT 0,
    anzahl_fehlgeschlagen INT DEFAULT 0,
    gesamtbetrag DECIMAL(10,2) DEFAULT 0.00,

    -- Verknüpfung zu Stripe-Batch
    stripe_batch_id VARCHAR(100) NULL,

    -- Fehler-Details
    fehler_details JSON NULL,

    INDEX idx_ausfuehrung_zeitplan (zeitplan_id),
    INDEX idx_ausfuehrung_dojo (dojo_id),
    INDEX idx_ausfuehrung_gestartet (gestartet_am),
    INDEX idx_ausfuehrung_status (status),
    FOREIGN KEY (zeitplan_id) REFERENCES lastschrift_zeitplaene(zeitplan_id) ON DELETE CASCADE,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
);

-- ============================================
-- 3. Dojo-Einstellungen erweitern
-- ============================================
-- Auto Stripe-Setup bei neuen Mitgliedern
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'dojo'
    AND COLUMN_NAME = 'auto_stripe_setup'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE dojo ADD COLUMN auto_stripe_setup BOOLEAN DEFAULT TRUE',
    'SELECT "auto_stripe_setup already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- E-Mail für Lastschrift-Benachrichtigungen
SET @col_exists2 = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'dojo'
    AND COLUMN_NAME = 'lastschrift_benachrichtigung_email'
);

SET @sql2 = IF(@col_exists2 = 0,
    'ALTER TABLE dojo ADD COLUMN lastschrift_benachrichtigung_email VARCHAR(255) NULL',
    'SELECT "lastschrift_benachrichtigung_email already exists"'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- ============================================
-- 4. Index für Stripe-Batch Verknüpfung
-- ============================================
-- Sicherstellen, dass stripe_batch_id in stripe_lastschrift_batch indexiert ist
-- (für schnelle Lookups bei Ausführungs-Verknüpfung)
-- Dies ist bereits durch batch_id UNIQUE abgedeckt
