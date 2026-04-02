-- Migration: Super Admin Benachrichtigungssystem
-- Erstellt Tabellen für das Benachrichtigungssystem im Super Admin Dashboard

-- Tabelle für Super-Admin Benachrichtigungen (eingehende Meldungen)
CREATE TABLE IF NOT EXISTS super_admin_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    typ VARCHAR(50) NOT NULL COMMENT 'z.B. dojo_registriert, verbandsmitglied_registriert, bestellung, system',
    titel VARCHAR(255) NOT NULL,
    nachricht TEXT,
    prioritaet ENUM('normal', 'wichtig', 'dringend') DEFAULT 'normal',
    empfaenger_typ VARCHAR(50) DEFAULT 'admin' COMMENT 'admin, alle, verbandsmitglieder, dojos, mitglieder',
    gelesen BOOLEAN DEFAULT FALSE,
    archiviert BOOLEAN DEFAULT FALSE,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gelesen_am TIMESTAMP NULL,
    archiviert_am TIMESTAMP NULL,

    INDEX idx_gelesen (gelesen),
    INDEX idx_archiviert (archiviert),
    INDEX idx_erstellt (erstellt_am),
    INDEX idx_typ (typ),
    INDEX idx_prioritaet (prioritaet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Benachrichtigungen an Verbandsmitglieder
CREATE TABLE IF NOT EXISTS verband_mitglied_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    verband_mitglied_id INT NOT NULL,
    typ VARCHAR(50) NOT NULL COMMENT 'push, system, info',
    titel VARCHAR(255) NOT NULL,
    nachricht TEXT,
    prioritaet ENUM('normal', 'wichtig', 'dringend') DEFAULT 'normal',
    gelesen BOOLEAN DEFAULT FALSE,
    archiviert BOOLEAN DEFAULT FALSE,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gelesen_am TIMESTAMP NULL,

    INDEX idx_mitglied (verband_mitglied_id),
    INDEX idx_gelesen (gelesen),
    INDEX idx_erstellt (erstellt_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Beispiel-Benachrichtigung einfügen (System-Start)
INSERT INTO super_admin_notifications (typ, titel, nachricht, prioritaet, empfaenger_typ)
VALUES ('system', 'Benachrichtigungssystem aktiviert', 'Das Super-Admin Benachrichtigungssystem wurde erfolgreich installiert.', 'normal', 'admin');
