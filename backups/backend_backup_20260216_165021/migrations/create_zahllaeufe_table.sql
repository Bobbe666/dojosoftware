-- Migration: Create zahllaeufe table
-- Date: 2025-01-06
-- Description: Tabelle für SEPA-Lastschriftläufe (Zahlläufe)

CREATE TABLE IF NOT EXISTS zahllaeufe (
    zahllauf_id INT AUTO_INCREMENT PRIMARY KEY,
    buchungsnummer VARCHAR(50) UNIQUE NOT NULL COMMENT 'Eindeutige Buchungsnummer (z.B. M-0045)',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Erstellungszeitpunkt',
    forderungen_bis DATE COMMENT 'Forderungen bis einschließlich Datum',
    geplanter_einzug DATE COMMENT 'Geplantes Einzugsdatum',
    zahlungsanbieter VARCHAR(100) DEFAULT 'SEPA (Finion AG)' COMMENT 'Name des Zahlungsanbieters',
    status ENUM('geplant', 'offen', 'abgeschlossen', 'fehler') DEFAULT 'geplant' COMMENT 'Status des Zahllaufs',
    anzahl_buchungen INT NOT NULL DEFAULT 0 COMMENT 'Anzahl der Buchungen/Mandate',
    betrag DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Gesamtbetrag in EUR',
    ruecklastschrift_anzahl INT DEFAULT 0 COMMENT 'Anzahl der Rücklastschriften',
    ruecklastschrift_prozent DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Prozentsatz der Rücklastschriften',
    csv_datei_pfad VARCHAR(255) COMMENT 'Pfad zur CSV-Exportdatei',
    xml_datei_pfad VARCHAR(255) COMMENT 'Pfad zur XML-Exportdatei',
    notizen TEXT COMMENT 'Zusätzliche Notizen zum Zahllauf',
    ersteller_user_id INT COMMENT 'ID des Users der den Zahllauf erstellt hat',
    abgeschlossen_am TIMESTAMP NULL COMMENT 'Zeitpunkt der Abschließung',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_buchungsnummer (buchungsnummer),
    INDEX idx_status (status),
    INDEX idx_erstellt_am (erstellt_am),
    INDEX idx_geplanter_einzug (geplanter_einzug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='SEPA-Lastschriftläufe mit Buchungsinformationen';

-- Add sample data for testing (optional)
INSERT INTO zahllaeufe (
    buchungsnummer,
    forderungen_bis,
    geplanter_einzug,
    zahlungsanbieter,
    status,
    anzahl_buchungen,
    betrag,
    ruecklastschrift_anzahl,
    ruecklastschrift_prozent,
    erstellt_am
) VALUES
-- Aktueller Monat (November 2025)
('M-0045', '2025-11-06', '2025-11-08', 'SEPA (Finion AG)', 'abgeschlossen', 4, 444.96, 0, 0.00, '2025-11-06 13:56:00'),

-- Oktober 2025
('M-0043', '2025-11-01', '2025-11-01', 'SEPA (Finion AG)', 'abgeschlossen', 22, 894.78, 2, 9.09, '2025-10-27 02:45:00'),

-- September 2025
('M-0042', '2025-10-02', '2025-10-02', 'SEPA (Finion AG)', 'abgeschlossen', 22, 932.77, 0, 0.00, '2025-09-27 02:45:00'),

-- August 2025
('M-0041', '2025-09-01', '2025-09-01', 'SEPA (Finion AG)', 'abgeschlossen', 22, 894.78, 1, 4.55, '2025-08-27 02:45:00'),

-- Juli 2025
('M-0040', '2025-08-01', '2025-08-01', 'SEPA (Finion AG)', 'abgeschlossen', 22, 1180.28, 0, 0.00, '2025-07-27 02:45:00'),

-- Juli 2025 - Zweiter Lauf
('M-0039', '2025-07-03', '2025-07-05', 'SEPA (Finion AG)', 'abgeschlossen', 2, 314.42, 0, 0.00, '2025-07-03 10:58:00'),

-- Juli 2025 - Dritter Lauf
('M-0038', '2025-07-03', '2025-07-05', 'SEPA (Finion AG)', 'abgeschlossen', 1, 166.52, 1, 100.00, '2025-07-03 10:22:00'),

-- Juni 2025
('M-0037', '2025-07-02', '2025-07-02', 'SEPA (Finion AG)', 'abgeschlossen', 20, 1106.73, 2, 10.00, '2025-06-27 02:45:00'),

-- Mai 2025
('M-0036', '2025-06-01', '2025-06-01', 'SEPA (Finion AG)', 'abgeschlossen', 20, 1010.75, 2, 10.00, '2025-05-27 02:45:00'),

-- April 2025
('M-0035', '2025-05-02', '2025-05-02', 'SEPA (Finion AG)', 'abgeschlossen', 20, 1038.11, 1, 5.00, '2025-04-27 02:45:00'),

-- März 2025
('M-0034', '2025-04-01', '2025-04-01', 'SEPA (Finion AG)', 'abgeschlossen', 20, 934.77, 1, 5.00, '2025-03-27 02:45:00');
