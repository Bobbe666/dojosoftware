-- Migration: Verbandsmitglieder-Rabatte für Artikel
-- Ermöglicht prozentuale Rabatte für zahlende Verbandsmitglieder

-- Rabatt-Konfiguration pro Artikel
CREATE TABLE IF NOT EXISTS verband_artikel_rabatte (
    id INT AUTO_INCREMENT PRIMARY KEY,
    artikel_id INT NOT NULL,

    -- Rabatt-Typ: 'prozent' oder 'festbetrag'
    rabatt_typ ENUM('prozent', 'festbetrag') DEFAULT 'prozent',

    -- Rabattwert (Prozent oder Cent)
    rabatt_wert DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Für welche Mitgliedschaftstypen gilt der Rabatt?
    gilt_fuer_dojo BOOLEAN DEFAULT TRUE,        -- Dojo-Mitgliedschaft
    gilt_fuer_einzelperson BOOLEAN DEFAULT TRUE, -- Einzelperson-Mitgliedschaft

    -- Mindestbestellmenge für Rabatt
    mindestmenge INT DEFAULT 1,

    -- Maximaler Rabatt in Cent (optional, 0 = unbegrenzt)
    max_rabatt_cent INT DEFAULT 0,

    -- Aktiv/Inaktiv
    aktiv BOOLEAN DEFAULT TRUE,

    -- Audit
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_artikel (artikel_id),
    INDEX idx_aktiv (aktiv),
    INDEX idx_artikel (artikel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Globale Rabatt-Einstellungen für den Verband
CREATE TABLE IF NOT EXISTS verband_rabatt_einstellungen (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Standard-Rabatt für alle Artikel ohne individuelle Einstellung
    standard_rabatt_prozent DECIMAL(5,2) DEFAULT 0,

    -- Ob Rabatte aktiv sind
    rabatte_aktiv BOOLEAN DEFAULT TRUE,

    -- Hinweistext für Nicht-Mitglieder
    hinweis_nicht_mitglied TEXT,

    -- Hinweistext für Basic-Mitglieder (unbezahlt)
    hinweis_basic_mitglied TEXT,

    -- Audit
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Standard-Einstellungen einfügen
INSERT INTO verband_rabatt_einstellungen (standard_rabatt_prozent, rabatte_aktiv, hinweis_nicht_mitglied, hinweis_basic_mitglied)
VALUES (
    10.00,
    TRUE,
    'Als Verbandsmitglied erhältst du exklusive Rabatte auf alle Artikel!',
    'Aktiviere deine Mitgliedschaft um von Mitgliederrabatten zu profitieren.'
);

-- Spalte für Rabatt-Anzeige in Artikel-Tabelle (optional für Performance)
ALTER TABLE artikel ADD COLUMN IF NOT EXISTS hat_verband_rabatt BOOLEAN DEFAULT FALSE;
ALTER TABLE artikel ADD COLUMN IF NOT EXISTS verband_rabatt_prozent DECIMAL(5,2) DEFAULT NULL;
