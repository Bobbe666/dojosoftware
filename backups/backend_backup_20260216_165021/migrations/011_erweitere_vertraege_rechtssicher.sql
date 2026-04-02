-- Migration 011: Erweitere Verträge für rechtssichere Vertragsgestaltung
-- Datum: 2025-10-12
-- Beschreibung: Fügt AGB, Datenschutz, Kündigungsbedingungen und Dokumenten-Management hinzu

-- ===================================================================
-- 1. VERTRÄGE TABELLE ERWEITERN
-- ===================================================================

-- Prüfe ob Spalten bereits existieren und füge nur fehlende hinzu
SET @dbname = DATABASE();
SET @tablename = 'vertraege';

-- Vertragsnummer
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'vertragsnummer';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN vertragsnummer VARCHAR(50) UNIQUE COMMENT \'Eindeutige Vertragsnummer (z.B. VTR-2024-001)\'',
  'SELECT \'Spalte vertragsnummer existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Kündigungsfrist
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'kuendigungsfrist_monate';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN kuendigungsfrist_monate INT DEFAULT 3 COMMENT \'Kündigungsfrist in Monaten vor Vertragsende\'',
  'SELECT \'Spalte kuendigungsfrist_monate existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Mindestlaufzeit
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'mindestlaufzeit_monate';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN mindestlaufzeit_monate INT DEFAULT 12 COMMENT \'Mindestvertragslaufzeit in Monaten\'',
  'SELECT \'Spalte mindestlaufzeit_monate existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Automatische Verlängerung
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'automatische_verlaengerung';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN automatische_verlaengerung BOOLEAN DEFAULT TRUE COMMENT \'Verlängert sich der Vertrag automatisch?\'',
  'SELECT \'Spalte automatische_verlaengerung existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verlängerungsmonate
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'verlaengerung_monate';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN verlaengerung_monate INT DEFAULT 12 COMMENT \'Um wie viele Monate verlängert sich der Vertrag?\'',
  'SELECT \'Spalte verlaengerung_monate existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fälligkeitstag
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'faelligkeit_tag';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN faelligkeit_tag INT DEFAULT 1 COMMENT \'Tag im Monat an dem Zahlung fällig ist\'',
  'SELECT \'Spalte faelligkeit_tag existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rabatt
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'rabatt_prozent';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN rabatt_prozent DECIMAL(5,2) DEFAULT 0 COMMENT \'Rabatt in Prozent\'',
  'SELECT \'Spalte rabatt_prozent existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'rabatt_grund';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN rabatt_grund VARCHAR(255) COMMENT \'Grund für Rabatt (Familien-Rabatt, Aktion, etc.)\'',
  'SELECT \'Spalte rabatt_grund existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- SEPA Mandat
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'sepa_mandat_id';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN sepa_mandat_id INT COMMENT \'Verknüpfung mit SEPA-Mandat\'',
  'SELECT \'Spalte sepa_mandat_id existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AGB
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'agb_version';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN agb_version VARCHAR(20) COMMENT \'Version der akzeptierten AGB\'',
  'SELECT \'Spalte agb_version existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'agb_akzeptiert_am';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN agb_akzeptiert_am DATETIME COMMENT \'Zeitpunkt der AGB-Akzeptanz\'',
  'SELECT \'Spalte agb_akzeptiert_am existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Datenschutz
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'datenschutz_version';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN datenschutz_version VARCHAR(20) COMMENT \'Version der akzeptierten Datenschutzerklärung\'',
  'SELECT \'Spalte datenschutz_version existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'datenschutz_akzeptiert_am';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN datenschutz_akzeptiert_am DATETIME COMMENT \'Zeitpunkt der Datenschutz-Akzeptanz\'',
  'SELECT \'Spalte datenschutz_akzeptiert_am existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Widerruf
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'widerruf_akzeptiert_am';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN widerruf_akzeptiert_am DATETIME COMMENT \'Widerrufsbelehrung zur Kenntnis genommen\'',
  'SELECT \'Spalte widerruf_akzeptiert_am existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Hausordnung
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'hausordnung_akzeptiert_am';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN hausordnung_akzeptiert_am DATETIME COMMENT \'Hausordnung akzeptiert\'',
  'SELECT \'Spalte hausordnung_akzeptiert_am existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Gesundheitserklärung
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'gesundheitserklaerung';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN gesundheitserklaerung BOOLEAN DEFAULT FALSE COMMENT \'Bestätigt gesundheitliche Eignung\'',
  'SELECT \'Spalte gesundheitserklaerung existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'gesundheitserklaerung_datum';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN gesundheitserklaerung_datum DATETIME COMMENT \'Zeitpunkt der Gesundheitserklärung\'',
  'SELECT \'Spalte gesundheitserklaerung_datum existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Haftungsausschluss
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'haftungsausschluss_akzeptiert';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN haftungsausschluss_akzeptiert BOOLEAN DEFAULT FALSE COMMENT \'Haftungsausschluss akzeptiert\'',
  'SELECT \'Spalte haftungsausschluss_akzeptiert existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'haftungsausschluss_datum';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN haftungsausschluss_datum DATETIME COMMENT \'Zeitpunkt der Haftungsausschluss-Akzeptanz\'',
  'SELECT \'Spalte haftungsausschluss_datum existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foto-Einverständnis
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_einverstaendnis';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN foto_einverstaendnis BOOLEAN DEFAULT FALSE COMMENT \'Einwilligung für Foto/Video-Aufnahmen\'',
  'SELECT \'Spalte foto_einverstaendnis existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'foto_einverstaendnis_datum';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN foto_einverstaendnis_datum DATETIME COMMENT \'Zeitpunkt der Foto-Einwilligung\'',
  'SELECT \'Spalte foto_einverstaendnis_datum existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Unterschrift
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'unterschrift_datum';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN unterschrift_datum DATETIME COMMENT \'Datum der Vertragsunterzeichnung\'',
  'SELECT \'Spalte unterschrift_datum existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'unterschrift_digital';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN unterschrift_digital LONGTEXT COMMENT \'Base64-kodierte digitale Unterschrift\'',
  'SELECT \'Spalte unterschrift_digital existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'unterschrift_ip';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN unterschrift_ip VARCHAR(45) COMMENT \'IP-Adresse bei digitaler Unterschrift\'',
  'SELECT \'Spalte unterschrift_ip existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'vertragstext_pdf_path';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN vertragstext_pdf_path VARCHAR(255) COMMENT \'Pfad zum generierten Vertrags-PDF\'',
  'SELECT \'Spalte vertragstext_pdf_path existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Metadaten
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'created_by';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN created_by INT COMMENT \'Benutzer der den Vertrag erstellt hat\'',
  'SELECT \'Spalte created_by existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'updated_by';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN updated_by INT COMMENT \'Benutzer der den Vertrag zuletzt bearbeitet hat\'',
  'SELECT \'Spalte updated_by existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'updated_at';
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE vertraege ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT \'Zeitpunkt der letzten Änderung\'',
  'SELECT \'Spalte updated_at existiert bereits\' AS Info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign Key Constraint für SEPA-Mandat (falls Tabelle existiert)
-- ALTER TABLE vertraege
-- ADD CONSTRAINT fk_vertraege_sepa_mandat
-- FOREIGN KEY (sepa_mandat_id) REFERENCES sepa_mandate(mandat_id) ON DELETE SET NULL;

-- ===================================================================
-- 2. VERTRAGSDOKUMENTE TABELLE (für AGB, Datenschutz, etc. pro Dojo)
-- ===================================================================

CREATE TABLE IF NOT EXISTS vertragsdokumente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL COMMENT 'Zugehöriges Dojo (Tax Compliance!)',
  dokumenttyp ENUM('agb', 'datenschutz', 'widerruf', 'hausordnung', 'haftung', 'sonstiges') NOT NULL COMMENT 'Art des Dokuments',
  version VARCHAR(20) NOT NULL COMMENT 'Versions-Nummer (z.B. 1.0, 2.1)',
  titel VARCHAR(255) NOT NULL COMMENT 'Titel des Dokuments',

  -- Inhalt
  inhalt LONGTEXT COMMENT 'Vollständiger Text des Dokuments (HTML/Markdown)',
  pdf_pfad VARCHAR(255) COMMENT 'Pfad zum PDF (falls vorhanden)',

  -- Gültigkeit
  gueltig_ab DATE NOT NULL COMMENT 'Ab wann ist dieses Dokument gültig',
  gueltig_bis DATE COMMENT 'Bis wann gültig (NULL = unbegrenzt)',
  aktiv BOOLEAN DEFAULT TRUE COMMENT 'Ist diese Version aktuell aktiv?',

  -- Metadaten
  erstellt_von INT COMMENT 'Benutzer der das Dokument erstellt hat',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Erstellungszeitpunkt',
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
  INDEX idx_dojo_dokumenttyp (dojo_id, dokumenttyp),
  INDEX idx_aktiv (aktiv),
  UNIQUE KEY unique_dojo_dokumenttyp_version (dojo_id, dokumenttyp, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Rechtliche Dokumente (AGB, Datenschutz, etc.) pro Dojo mit Versionierung';

-- ===================================================================
-- 3. VERTRAGSHISTORIE TABELLE (für Änderungsprotokoll)
-- ===================================================================

CREATE TABLE IF NOT EXISTS vertragshistorie (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vertrag_id INT NOT NULL COMMENT 'Zugehöriger Vertrag',
  aenderung_typ ENUM('erstellt', 'geaendert', 'gekuendigt', 'pausiert', 'reaktiviert', 'beendet') NOT NULL COMMENT 'Art der Änderung',
  aenderung_beschreibung TEXT COMMENT 'Beschreibung der Änderung',
  aenderung_details JSON COMMENT 'Detaillierte Änderungen (vorher/nachher)',

  -- Wer & Wann
  geaendert_von INT COMMENT 'Benutzer der die Änderung vorgenommen hat',
  geaendert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Zeitpunkt der Änderung',
  ip_adresse VARCHAR(45) COMMENT 'IP-Adresse (falls relevant)',

  FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE,
  INDEX idx_vertrag_datum (vertrag_id, geaendert_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Protokolliert alle Änderungen an Verträgen für Revisionssicherheit';

-- ===================================================================
-- 4. VERTRAGSLEISTUNGEN TABELLE (was ist im Vertrag enthalten)
-- ===================================================================

CREATE TABLE IF NOT EXISTS vertragsleistungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vertrag_id INT NOT NULL COMMENT 'Zugehöriger Vertrag',

  -- Leistungsumfang
  beschreibung TEXT COMMENT 'Beschreibung der Leistungen',
  anzahl_einheiten_pro_woche INT DEFAULT 2 COMMENT 'Anzahl Trainingseinheiten pro Woche',
  standorte TEXT COMMENT 'Welche Dojos/Standorte nutzbar (JSON Array)',
  inkludierte_kurse TEXT COMMENT 'Welche Kurse sind enthalten (JSON Array)',

  -- Zusatzleistungen
  zusatzleistungen TEXT COMMENT 'Was ist zusätzlich enthalten (Events, Prüfungen, etc.)',
  ausschluesse TEXT COMMENT 'Was ist NICHT enthalten',

  -- Urlaubsregelung
  urlaubstage_pro_jahr INT DEFAULT 0 COMMENT 'Anzahl Tage Urlaubspause pro Jahr',
  urlaubsregelung TEXT COMMENT 'Beschreibung der Urlaubsregelung',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Definiert den Leistungsumfang eines Vertrags';

-- ===================================================================
-- 5. INITIALE DATEN: Standard-Dokumente für bestehende Dojos
-- ===================================================================

-- Füge Standard-AGB für jedes aktive Dojo hinzu
INSERT INTO vertragsdokumente (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, aktiv)
SELECT
    id AS dojo_id,
    'agb' AS dokumenttyp,
    '1.0' AS version,
    'Allgemeine Geschäftsbedingungen' AS titel,
    CONCAT(
        '<h1>Allgemeine Geschäftsbedingungen</h1>',
        '<h2>§1 Vertragsparteien</h2>',
        '<p>Dieser Vertrag wird geschlossen zwischen:</p>',
        '<p><strong>', dojoname, '</strong><br>',
        COALESCE(strasse, ''), ' ', COALESCE(hausnummer, ''), '<br>',
        COALESCE(plz, ''), ' ', COALESCE(ort, ''), '<br>',
        'vertreten durch: ', COALESCE(inhaber, ''), '</p>',
        '<p>- nachfolgend "Verein" genannt - und dem Mitglied gemäß den im Vertrag angegebenen Daten.</p>',
        '<h2>§2 Kündigungsfrist</h2>',
        '<p><strong>WICHTIG:</strong> Die Kündigungsfrist bezieht sich auf das im Vertrag angegebene <strong>Vertragsende</strong>, nicht auf die Laufzeit.</p>',
        '<p>Bei einer Kündigungsfrist von 3 Monaten bedeutet dies:<br>',
        'Die Kündigung muss <strong>mindestens 3 Monate VOR dem Vertragsende</strong> beim Verein eingehen. ',
        'Der Vertrag endet dann zum ursprünglich vereinbarten Vertragsende.</p>',
        '<p><em>Beispiel:</em> Bei einem Vertrag mit Laufzeit bis 31.12.2025 und 3 Monaten Kündigungsfrist ',
        'muss die Kündigung spätestens am 30.09.2025 beim Verein vorliegen. Der Vertrag endet dann am 31.12.2025.</p>',
        '<h2>§3 Automatische Vertragsverlängerung</h2>',
        '<p>Sofern im Vertrag nicht anders vereinbart, verlängert sich der Vertrag automatisch um die angegebene Verlängerungsdauer, ',
        'wenn er nicht fristgerecht gekündigt wird.</p>',
        '<h2>§4 Zahlungsbedingungen</h2>',
        '<p>Die Beitragszahlung erfolgt gemäß dem im Vertrag angegebenen Zahlungsintervall. ',
        'Die erste Zahlung ist mit Vertragsbeginn fällig.</p>',
        '<p>Bei Zahlungsverzug behält sich der Verein vor, das Mitglied vom Training auszuschließen.</p>',
        '<h2>§5 Haftung</h2>',
        '<p>Das Mitglied nimmt am Training auf eigene Gefahr teil. ',
        'Der Verein haftet nicht für Schäden, die während des Trainings entstehen, ',
        'es sei denn, diese beruhen auf Vorsatz oder grober Fahrlässigkeit.</p>',
        '<p>Das Mitglied wird dringend empfohlen, eine private Unfallversicherung abzuschließen.</p>',
        '<h2>§6 Hausordnung</h2>',
        '<p>Das Mitglied verpflichtet sich, die Hausordnung des Dojos einzuhalten.</p>',
        '<p><em>Diese AGB wurden zuletzt aktualisiert am: ', CURDATE(), '</em></p>'
    ) AS inhalt,
    CURDATE() AS gueltig_ab,
    TRUE AS aktiv
FROM dojo
WHERE ist_aktiv = TRUE
ON DUPLICATE KEY UPDATE inhalt = VALUES(inhalt);

-- Füge Standard-Datenschutzerklärung für jedes aktive Dojo hinzu
INSERT INTO vertragsdokumente (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, aktiv)
SELECT
    id AS dojo_id,
    'datenschutz' AS dokumenttyp,
    '1.0' AS version,
    'Datenschutzerklärung' AS titel,
    CONCAT(
        '<h1>Datenschutzerklärung</h1>',
        '<p>Verantwortlich für die Datenverarbeitung:</p>',
        '<p><strong>', dojoname, '</strong><br>',
        COALESCE(strasse, ''), ' ', COALESCE(hausnummer, ''), '<br>',
        COALESCE(plz, ''), ' ', COALESCE(ort, ''), '<br>',
        'E-Mail: ', COALESCE(email, ''), '</p>',
        '<h2>1. Datenverarbeitung</h2>',
        '<p>Wir verarbeiten Ihre personenbezogenen Daten (Name, Adresse, Geburtsdatum, Kontaktdaten, Bankverbindung) ',
        'ausschließlich zum Zweck der Vertragsdurchführung und -verwaltung.</p>',
        '<h2>2. Rechtsgrundlage</h2>',
        '<p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>',
        '<h2>3. Speicherdauer</h2>',
        '<p>Ihre Daten werden für die Dauer der Vertragslaufzeit sowie gemäß den gesetzlichen Aufbewahrungsfristen gespeichert.</p>',
        '<h2>4. Ihre Rechte</h2>',
        '<p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, ',
        'Datenübertragbarkeit und Widerspruch gegen die Verarbeitung Ihrer Daten.</p>',
        '<p>Kontaktieren Sie uns unter: ', COALESCE(email, ''), '</p>',
        '<h2>5. SEPA-Lastschriftmandat</h2>',
        '<p>Bei Erteilung eines SEPA-Lastschriftmandats werden Ihre Bankdaten ausschließlich zur Durchführung ',
        'der vereinbarten Zahlungen verwendet.</p>',
        '<p><em>Stand: ', CURDATE(), '</em></p>'
    ) AS inhalt,
    CURDATE() AS gueltig_ab,
    TRUE AS aktiv
FROM dojo
WHERE ist_aktiv = TRUE
ON DUPLICATE KEY UPDATE inhalt = VALUES(inhalt);

-- ===================================================================
-- 6. INDIZES FÜR PERFORMANCE
-- ===================================================================

-- Index für schnelle Vertragsnummern-Suche (falls nicht schon durch UNIQUE erstellt)
-- CREATE INDEX idx_vertragsnummer ON vertraege(vertragsnummer);

-- Index für Verträge nach Status und Dojo
CREATE INDEX IF NOT EXISTS idx_vertraege_status_dojo ON vertraege(status, dojo_id);

-- Index für Verträge nach Vertragsdaten
CREATE INDEX IF NOT EXISTS idx_vertraege_datum ON vertraege(vertragsbeginn, vertragsende);

-- ===================================================================
-- FERTIG! Migration 011 erfolgreich
-- ===================================================================
