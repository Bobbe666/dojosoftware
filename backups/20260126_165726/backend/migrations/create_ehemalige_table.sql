-- =====================================================================================
-- MIGRATION: Tabelle für ehemalige Mitglieder erstellen
-- =====================================================================================
-- Erstellt eine Tabelle für ehemalige Mitglieder mit vollständiger Historie
-- =====================================================================================

CREATE TABLE IF NOT EXISTS ehemalige (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Referenz zum ursprünglichen Mitglied (falls noch in DB)
    urspruengliches_mitglied_id INT NULL COMMENT 'Referenz zum ursprünglichen Mitglied in mitglieder-Tabelle',

    -- Dojo-Zuordnung (Tax Compliance)
    dojo_id INT NOT NULL COMMENT 'Dojo-Zuordnung (Tax Compliance)',

    -- Persönliche Daten
    vorname VARCHAR(100) NOT NULL,
    nachname VARCHAR(100) NOT NULL,
    geburtsdatum DATE NULL,
    geschlecht ENUM('m', 'w', 'd') NULL,

    -- Kontaktdaten
    email VARCHAR(255) NULL,
    telefon VARCHAR(50) NULL,
    telefon_mobil VARCHAR(50) NULL,
    strasse VARCHAR(255) NULL,
    hausnummer VARCHAR(20) NULL,
    plz VARCHAR(10) NULL,
    ort VARCHAR(100) NULL,

    -- Mitgliedschaft-Daten
    urspruengliches_eintrittsdatum DATE NULL COMMENT 'Datum des ursprünglichen Eintritts',
    austrittsdatum DATE NULL COMMENT 'Datum des Austritts',
    austrittsgrund TEXT NULL COMMENT 'Grund für den Austritt',
    letzter_tarif VARCHAR(255) NULL COMMENT 'Letzter gebuchter Tarif',

    -- Graduierungen
    letzter_guertel VARCHAR(100) NULL COMMENT 'Letzter erreichter Gürtel/Graduierung',
    letzter_stil VARCHAR(100) NULL COMMENT 'Letzter trainierter Stil',

    -- Notizen
    notizen TEXT NULL COMMENT 'Interne Notizen zum ehemaligen Mitglied',

    -- Wiederaufnahme
    wiederaufnahme_moeglich BOOLEAN DEFAULT TRUE COMMENT 'Kann das Mitglied wieder aufgenommen werden?',
    wiederaufnahme_gesperrt_bis DATE NULL COMMENT 'Gesperrt bis zu diesem Datum',

    -- Archivierung
    archiviert BOOLEAN DEFAULT FALSE COMMENT 'Komplett archiviert (nicht mehr in Listen anzeigen)',

    -- Zeitstempel
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Keys
    FOREIGN KEY (dojo_id) REFERENCES dojos(id) ON DELETE RESTRICT,
    FOREIGN KEY (urspruengliches_mitglied_id) REFERENCES mitglieder(id) ON DELETE SET NULL,

    -- Indizes
    INDEX idx_ehemalige_dojo (dojo_id),
    INDEX idx_ehemalige_name (nachname, vorname),
    INDEX idx_ehemalige_austrittsdatum (austrittsdatum),
    INDEX idx_ehemalige_archiviert (archiviert),
    INDEX idx_ehemalige_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ehemalige Mitglieder mit vollständiger Historie';

SELECT 'Migration: Tabelle ehemalige erfolgreich erstellt' AS Status;
