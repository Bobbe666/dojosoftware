-- Archiv-Tabelle für ehemalige Mitglieder
-- Speichert alle Informationen aus der mitglieder-Tabelle plus zusätzliche Archiv-Metadaten

CREATE TABLE IF NOT EXISTS archiv_mitglieder (
  archiv_id INT AUTO_INCREMENT PRIMARY KEY,

  -- Original Mitglieder-Daten
  mitglied_id INT NOT NULL COMMENT 'Ursprüngliche Mitgliedsnummer',
  dojo_id INT DEFAULT NULL,
  vorname VARCHAR(100) DEFAULT NULL,
  nachname VARCHAR(100) DEFAULT NULL,
  geburtsdatum DATE DEFAULT NULL,
  strasse VARCHAR(100) DEFAULT NULL,
  plz VARCHAR(10) DEFAULT NULL,
  ort VARCHAR(100) DEFAULT NULL,
  land VARCHAR(50) DEFAULT 'Deutschland',
  telefon VARCHAR(20) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  eintrittsdatum DATE DEFAULT NULL,
  status VARCHAR(50) DEFAULT NULL,
  notizen TEXT,
  foto_pfad VARCHAR(255) DEFAULT NULL,

  -- Vertrags- und Zahlungsinformationen
  tarif_id INT DEFAULT NULL,
  zahlungszyklus_id INT DEFAULT NULL,
  gekuendigt BOOLEAN DEFAULT FALSE,
  gekuendigt_am DATE DEFAULT NULL,
  kuendigungsgrund TEXT DEFAULT NULL,

  -- Vereinsordnung
  vereinsordnung_akzeptiert BOOLEAN DEFAULT FALSE,
  vereinsordnung_datum DATE DEFAULT NULL,

  -- Sicherheitsinformationen
  security_question VARCHAR(255) DEFAULT NULL,
  security_answer VARCHAR(255) DEFAULT NULL,

  -- Stil-Daten (JSON oder separater String)
  stil_daten JSON DEFAULT NULL COMMENT 'Alle Stil-Zuordnungen und Graduierungen als JSON',

  -- SEPA-Mandate (JSON)
  sepa_mandate JSON DEFAULT NULL COMMENT 'Alle SEPA-Mandate als JSON',

  -- Prüfungshistorie (JSON)
  pruefungen JSON DEFAULT NULL COMMENT 'Alle Prüfungen als JSON',

  -- User/Login-Daten (JSON)
  user_daten JSON DEFAULT NULL COMMENT 'Login-Daten (ohne Passwort) als JSON',

  -- Archiv-Metadaten
  archiviert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  archiviert_von INT DEFAULT NULL COMMENT 'User-ID des Administrators',
  archivierungsgrund TEXT DEFAULT NULL,

  -- Zeitstempel
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_mitglied_id (mitglied_id),
  INDEX idx_nachname (nachname),
  INDEX idx_email (email),
  INDEX idx_archiviert_am (archiviert_am),
  INDEX idx_dojo_id (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Archiv für Mitglied-Stil-Daten
CREATE TABLE IF NOT EXISTS archiv_mitglied_stil_data (
  archiv_stil_id INT AUTO_INCREMENT PRIMARY KEY,
  archiv_id INT NOT NULL COMMENT 'Referenz zur archiv_mitglieder Tabelle',
  mitglied_id INT NOT NULL,
  stil_id INT NOT NULL,
  current_graduierung_id INT DEFAULT NULL,
  aktiv_seit DATE DEFAULT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archiviert_am DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (archiv_id) REFERENCES archiv_mitglieder(archiv_id) ON DELETE CASCADE,
  INDEX idx_archiv_id (archiv_id),
  INDEX idx_mitglied_id (mitglied_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- View zum einfachen Abrufen archivierter Mitglieder mit Zusammenfassung
CREATE OR REPLACE VIEW v_archiv_mitglieder_uebersicht AS
SELECT
  am.archiv_id,
  am.mitglied_id,
  am.vorname,
  am.nachname,
  am.email,
  am.eintrittsdatum,
  am.gekuendigt_am,
  am.archiviert_am,
  am.archivierungsgrund,
  CONCAT(am.vorname, ' ', am.nachname) AS vollername,
  TIMESTAMPDIFF(MONTH, am.eintrittsdatum, am.gekuendigt_am) AS mitgliedschaft_monate,
  d.dojoname AS dojo_name
FROM archiv_mitglieder am
LEFT JOIN dojo d ON am.dojo_id = d.id
ORDER BY am.archiviert_am DESC;
