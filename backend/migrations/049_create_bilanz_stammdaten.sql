-- =====================================================
-- Migration 049: Bilanz-Stammdaten Tabelle
-- Speichert Eröffnungsbilanzen und manuelle Bilanzwerte
-- (Anfangsbestände, Sachanlagen, Darlehen)
-- =====================================================

CREATE TABLE IF NOT EXISTS bilanz_stammdaten (
    stammdaten_id INT AUTO_INCREMENT PRIMARY KEY,

    -- Organisation/Dojo
    dojo_id INT NOT NULL DEFAULT 1,
    organisation_name VARCHAR(100) NOT NULL,
    jahr INT NOT NULL,

    -- Eröffnungsbilanzen (Anfangsbestände zum 01.01.)
    bank_anfangsbestand DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Bankkonto-Saldo zum Jahresbeginn',
    kasse_anfangsbestand DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Kassenbestand zum Jahresbeginn',

    -- Anlagevermögen (Sachanlagen)
    sachanlagen DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Buchwert der Sachanlagen (Equipment, Möbel, etc.)',
    sachanlagen_beschreibung TEXT COMMENT 'Auflistung der Sachanlagen',

    -- Eigenkapital
    eigenkapital_anfang DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Eigenkapital zum Jahresbeginn (vor Gewinn/Verlust)',

    -- Verbindlichkeiten
    darlehen DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Langfristige Darlehen und Kredite',
    darlehen_beschreibung TEXT COMMENT 'Details zu Darlehen (Gläubiger, Laufzeit, Zinssatz)',

    -- Audit-Trail (GoBD-konform)
    erstellt_von INT NOT NULL COMMENT 'User ID des Erstellers',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geaendert_von INT NULL COMMENT 'User ID der letzten Änderung',
    geaendert_am TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

    -- Indizes
    UNIQUE KEY unique_org_jahr (dojo_id, organisation_name, jahr),
    INDEX idx_dojo_jahr (dojo_id, jahr),
    INDEX idx_jahr (jahr)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Bilanz-Stammdaten: Eröffnungsbilanzen und manuelle Bilanzwerte';

-- =====================================================
-- Beispiel-Daten für Kampfkunstschule Schreiner (optional)
-- =====================================================
-- INSERT INTO bilanz_stammdaten (
--     dojo_id,
--     organisation_name,
--     jahr,
--     bank_anfangsbestand,
--     kasse_anfangsbestand,
--     sachanlagen,
--     sachanlagen_beschreibung,
--     eigenkapital_anfang,
--     erstellt_von
-- ) VALUES (
--     1,
--     'Kampfkunstschule Schreiner',
--     2025,
--     10000.00,  -- Bank-Anfangsbestand
--     500.00,    -- Kasse-Anfangsbestand
--     15000.00,  -- Sachanlagen (Matten, Equipment, etc.)
--     'Trainingsmatten, Pratzen, Sandsäcke, Büromöbel',
--     25000.00,  -- Eigenkapital-Anfang
--     1          -- Erstellt von User ID 1
-- ) ON DUPLICATE KEY UPDATE geaendert_von = 1, geaendert_am = CURRENT_TIMESTAMP;
