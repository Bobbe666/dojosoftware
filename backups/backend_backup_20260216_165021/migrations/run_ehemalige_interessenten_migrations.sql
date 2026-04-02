-- =====================================================================================
-- MIGRATIONS: Ehemalige und Interessenten - Beide Tabellen erstellen
-- =====================================================================================
-- Dieses Skript erstellt beide Tabellen auf einmal
-- =====================================================================================

-- 1. Erstelle Tabelle für ehemalige Mitglieder
CREATE TABLE IF NOT EXISTS ehemalige (
    id INT AUTO_INCREMENT PRIMARY KEY,
    urspruengliches_mitglied_id INT NULL COMMENT 'Referenz zum ursprünglichen Mitglied in mitglieder-Tabelle',
    dojo_id INT NOT NULL COMMENT 'Dojo-Zuordnung (Tax Compliance)',
    vorname VARCHAR(100) NOT NULL,
    nachname VARCHAR(100) NOT NULL,
    geburtsdatum DATE NULL,
    geschlecht ENUM('m', 'w', 'd') NULL,
    email VARCHAR(255) NULL,
    telefon VARCHAR(50) NULL,
    telefon_mobil VARCHAR(50) NULL,
    strasse VARCHAR(255) NULL,
    hausnummer VARCHAR(20) NULL,
    plz VARCHAR(10) NULL,
    ort VARCHAR(100) NULL,
    urspruengliches_eintrittsdatum DATE NULL COMMENT 'Datum des ursprünglichen Eintritts',
    austrittsdatum DATE NULL COMMENT 'Datum des Austritts',
    austrittsgrund TEXT NULL COMMENT 'Grund für den Austritt',
    letzter_tarif VARCHAR(255) NULL COMMENT 'Letzter gebuchter Tarif',
    letzter_guertel VARCHAR(100) NULL COMMENT 'Letzter erreichter Gürtel/Graduierung',
    letzter_stil VARCHAR(100) NULL COMMENT 'Letzter trainierter Stil',
    notizen TEXT NULL COMMENT 'Interne Notizen zum ehemaligen Mitglied',
    wiederaufnahme_moeglich BOOLEAN DEFAULT TRUE COMMENT 'Kann das Mitglied wieder aufgenommen werden?',
    wiederaufnahme_gesperrt_bis DATE NULL COMMENT 'Gesperrt bis zu diesem Datum',
    archiviert BOOLEAN DEFAULT FALSE COMMENT 'Komplett archiviert (nicht mehr in Listen anzeigen)',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojos(id) ON DELETE RESTRICT,
    FOREIGN KEY (urspruengliches_mitglied_id) REFERENCES mitglieder(id) ON DELETE SET NULL,
    INDEX idx_ehemalige_dojo (dojo_id),
    INDEX idx_ehemalige_name (nachname, vorname),
    INDEX idx_ehemalige_austrittsdatum (austrittsdatum),
    INDEX idx_ehemalige_archiviert (archiviert),
    INDEX idx_ehemalige_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ehemalige Mitglieder mit vollständiger Historie';

-- 2. Erstelle Tabelle für Interessenten
CREATE TABLE IF NOT EXISTS interessenten (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL COMMENT 'Interessiert an diesem Dojo',
    vorname VARCHAR(100) NOT NULL,
    nachname VARCHAR(100) NOT NULL,
    geburtsdatum DATE NULL,
    alter INT NULL COMMENT 'Alter des Interessenten',
    email VARCHAR(255) NULL,
    telefon VARCHAR(50) NULL,
    telefon_mobil VARCHAR(50) NULL,
    strasse VARCHAR(255) NULL,
    hausnummer VARCHAR(20) NULL,
    plz VARCHAR(10) NULL,
    ort VARCHAR(100) NULL,
    interessiert_an TEXT NULL COMMENT 'Welche Kampfkunst/Programm interessiert den Prospect?',
    erfahrung VARCHAR(255) NULL COMMENT 'Vorherige Kampfkunst-Erfahrung',
    gewuenschter_tarif VARCHAR(255) NULL COMMENT 'Gewünschter Tarif (falls angegeben)',
    erstkontakt_datum DATE NULL COMMENT 'Datum des ersten Kontakts',
    erstkontakt_quelle VARCHAR(100) NULL COMMENT 'Quelle: Website, Empfehlung, Facebook, etc.',
    letzter_kontakt_datum DATE NULL COMMENT 'Datum des letzten Kontakts',
    naechster_kontakt_datum DATE NULL COMMENT 'Geplanter nächster Kontakt',
    status ENUM('neu', 'kontaktiert', 'probetraining_vereinbart', 'probetraining_absolviert', 'angebot_gesendet', 'interessiert', 'nicht_interessiert', 'konvertiert') DEFAULT 'neu',
    konvertiert_zu_mitglied_id INT NULL COMMENT 'Referenz zum Mitglied (falls konvertiert)',
    konvertiert_am DATE NULL COMMENT 'Datum der Konvertierung zum Mitglied',
    probetraining_datum DATE NULL COMMENT 'Datum des vereinbarten Probetrainings',
    probetraining_absolviert BOOLEAN DEFAULT FALSE,
    probetraining_feedback TEXT NULL COMMENT 'Feedback nach Probetraining',
    notizen TEXT NULL COMMENT 'Interne Notizen zum Interessenten',
    newsletter_angemeldet BOOLEAN DEFAULT FALSE,
    datenschutz_akzeptiert BOOLEAN DEFAULT FALSE,
    datenschutz_akzeptiert_am TIMESTAMP NULL,
    prioritaet ENUM('niedrig', 'mittel', 'hoch') DEFAULT 'mittel',
    zustaendig_user_id INT NULL COMMENT 'Zuständiger Mitarbeiter für Follow-up',
    archiviert BOOLEAN DEFAULT FALSE COMMENT 'Nicht mehr aktiv verfolgen',
    archiviert_grund VARCHAR(255) NULL COMMENT 'Grund für Archivierung',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojos(id) ON DELETE RESTRICT,
    FOREIGN KEY (konvertiert_zu_mitglied_id) REFERENCES mitglieder(id) ON DELETE SET NULL,
    FOREIGN KEY (zustaendig_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_interessenten_dojo (dojo_id),
    INDEX idx_interessenten_name (nachname, vorname),
    INDEX idx_interessenten_status (status),
    INDEX idx_interessenten_email (email),
    INDEX idx_interessenten_erstkontakt (erstkontakt_datum),
    INDEX idx_interessenten_naechster_kontakt (naechster_kontakt_datum),
    INDEX idx_interessenten_archiviert (archiviert),
    INDEX idx_interessenten_prioritaet (prioritaet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Interessenten und potenzielle Mitglieder';

SELECT 'Migration: Beide Tabellen (ehemalige & interessenten) erfolgreich erstellt' AS Status;
