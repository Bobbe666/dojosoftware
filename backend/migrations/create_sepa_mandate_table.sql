-- Migration: Create sepa_mandate table with proper structure
-- Date: 2025-01-06
-- Description: Creates SEPA mandate table for managing direct debit authorizations

CREATE TABLE IF NOT EXISTS sepa_mandate (
    mandat_id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL,
    iban VARCHAR(34) NOT NULL,
    bic VARCHAR(11),
    bank_name VARCHAR(255),
    kontoinhaber VARCHAR(255) NOT NULL,
    mandatsreferenz VARCHAR(35) UNIQUE,
    glaeubiger_id VARCHAR(35) DEFAULT 'DE98ZZZ09999999999', -- Standard Gläubiger-ID
    status ENUM('aktiv', 'inaktiv', 'ausstehend', 'pausiert', 'gekuendigt') DEFAULT 'aktiv',
    erstellungsdatum TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    letzte_nutzung TIMESTAMP NULL,
    letzte_abrechnung DATE NULL,
    notizen TEXT,
    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
    INDEX idx_mitglied (mitglied_id),
    INDEX idx_status (status),
    INDEX idx_mandatsreferenz (mandatsreferenz)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE sepa_mandate COMMENT = 'SEPA-Lastschriftmandate für automatische Beitragseinzüge';
