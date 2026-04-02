-- =====================================================================================
-- FORTSCHRITTS-TRACKING FÜR DOJOSOFTWARE - MITGLIEDER-FORTSCHRITT
-- =====================================================================================
-- Tracking von Mitglieder-Fortschritt, Zielen, Meilensteinen und Skills
-- Erstellt: 2025-10-07
-- =====================================================================================

-- 1. FORTSCHRITTS-KATEGORIEN
-- =====================================================================================
CREATE TABLE IF NOT EXISTS fortschritt_kategorien (
  kategorie_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  beschreibung TEXT,
  icon VARCHAR(50) DEFAULT 'target',
  farbe_hex VARCHAR(7) DEFAULT '#ffd700',
  reihenfolge INT DEFAULT 0,
  aktiv BOOLEAN DEFAULT TRUE,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Standard-Kategorien einfügen
INSERT IGNORE INTO fortschritt_kategorien (name, beschreibung, icon, farbe_hex, reihenfolge) VALUES
('Techniken', 'Martial Arts Techniken und Bewegungen', 'zap', '#ffd700', 1),
('Fitness', 'Kondition, Kraft und Ausdauer', 'activity', '#ff6b35', 2),
('Flexibilität', 'Dehnübungen und Beweglichkeit', 'wind', '#06B6D4', 3),
('Kata/Formen', 'Kata, Formen und Choreografien', 'layers', '#8B5CF6', 4),
('Kumite/Sparring', 'Kampf und Sparring Fähigkeiten', 'shield', '#EF4444', 5),
('Theorie', 'Wissen über Martial Arts Geschichte und Philosophie', 'book', '#10B981', 6);

-- =====================================================================================
-- 2. MITGLIEDER FORTSCHRITT
-- =====================================================================================
CREATE TABLE IF NOT EXISTS mitglieder_fortschritt (
  fortschritt_id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  kategorie_id INT NOT NULL,

  -- Skill/Fertigkeit Details
  skill_name VARCHAR(200) NOT NULL,
  beschreibung TEXT,

  -- Fortschritt (0-100%)
  fortschritt_prozent INT DEFAULT 0 CHECK (fortschritt_prozent >= 0 AND fortschritt_prozent <= 100),

  -- Status
  status ENUM('nicht_gestartet', 'in_arbeit', 'gemeistert', 'auf_eis') DEFAULT 'nicht_gestartet',

  -- Wichtigkeit und Priorität
  prioritaet ENUM('niedrig', 'mittel', 'hoch', 'kritisch') DEFAULT 'mittel',
  schwierigkeit ENUM('anfaenger', 'fortgeschritten', 'experte', 'meister') DEFAULT 'anfaenger',

  -- Zeiterfassung
  gestartet_am DATE NULL,
  gemeistert_am DATE NULL,
  ziel_datum DATE NULL,

  -- Bewertung durch Trainer
  trainer_bewertung INT NULL CHECK (trainer_bewertung >= 1 AND trainer_bewertung <= 5),
  trainer_kommentar TEXT,
  bewertet_von INT NULL,
  bewertet_am TIMESTAMP NULL,

  -- Timestamps
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  FOREIGN KEY (kategorie_id) REFERENCES fortschritt_kategorien(kategorie_id) ON DELETE CASCADE,

  -- Indizes
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_kategorie (kategorie_id),
  INDEX idx_status (status),
  INDEX idx_prioritaet (prioritaet)
);

-- =====================================================================================
-- 3. FORTSCHRITTS-UPDATES / HISTORY
-- =====================================================================================
CREATE TABLE IF NOT EXISTS fortschritt_updates (
  update_id INT AUTO_INCREMENT PRIMARY KEY,
  fortschritt_id INT NOT NULL,
  mitglied_id INT NOT NULL,

  -- Was wurde geändert
  alter_fortschritt INT,
  neuer_fortschritt INT,
  alter_status VARCHAR(50),
  neuer_status VARCHAR(50),

  -- Notizen und Feedback
  notiz TEXT,
  trainer_feedback TEXT,

  -- Wer hat es aktualisiert
  aktualisiert_von INT NULL,
  aktualisiert_von_name VARCHAR(100),

  -- Timestamp
  update_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (fortschritt_id) REFERENCES mitglieder_fortschritt(fortschritt_id) ON DELETE CASCADE,
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,

  -- Indizes
  INDEX idx_fortschritt (fortschritt_id),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_timestamp (update_timestamp)
);

-- =====================================================================================
-- 4. MEILENSTEINE
-- =====================================================================================
CREATE TABLE IF NOT EXISTS mitglieder_meilensteine (
  meilenstein_id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,

  -- Meilenstein Details
  titel VARCHAR(200) NOT NULL,
  beschreibung TEXT,
  typ ENUM('pruefung', 'turnier', 'achievement', 'persoenlich', 'sonstiges') DEFAULT 'achievement',

  -- Status
  erreicht BOOLEAN DEFAULT FALSE,
  erreicht_am DATE NULL,

  -- Zieldatum
  ziel_datum DATE NULL,

  -- Belohnung/Auszeichnung
  belohnung VARCHAR(200),
  auszeichnung_bild_url VARCHAR(500),

  -- Öffentliche Sichtbarkeit
  oeffentlich BOOLEAN DEFAULT FALSE,

  -- Timestamps
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,

  -- Indizes
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_typ (typ),
  INDEX idx_erreicht (erreicht)
);

-- =====================================================================================
-- 5. ZIELE (GOALS)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS mitglieder_ziele (
  ziel_id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,

  -- Ziel Details
  titel VARCHAR(200) NOT NULL,
  beschreibung TEXT,

  -- Zeitrahmen
  start_datum DATE NOT NULL,
  ziel_datum DATE NOT NULL,

  -- Status
  status ENUM('aktiv', 'erreicht', 'verfehlt', 'abgebrochen') DEFAULT 'aktiv',
  fortschritt_prozent INT DEFAULT 0 CHECK (fortschritt_prozent >= 0 AND fortschritt_prozent <= 100),

  -- Messbares Ziel
  messbar BOOLEAN DEFAULT FALSE,
  einheit VARCHAR(50), -- z.B. "Liegestütze", "Minuten", "Kilometer"
  ziel_wert DECIMAL(10,2),
  aktueller_wert DECIMAL(10,2) DEFAULT 0,

  -- Priorität
  prioritaet ENUM('niedrig', 'mittel', 'hoch') DEFAULT 'mittel',

  -- Erreicht am
  erreicht_am DATE NULL,

  -- Timestamps
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,

  -- Indizes
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_status (status),
  INDEX idx_ziel_datum (ziel_datum)
);

-- =====================================================================================
-- 6. TRAININGS-NOTIZEN
-- =====================================================================================
CREATE TABLE IF NOT EXISTS trainings_notizen (
  notiz_id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  trainer_id INT NULL,

  -- Notiz Content
  titel VARCHAR(200),
  notiz TEXT NOT NULL,
  typ ENUM('allgemein', 'staerke', 'schwaeche', 'verbesserung', 'verletzung', 'sonstiges') DEFAULT 'allgemein',

  -- Sichtbarkeit
  privat BOOLEAN DEFAULT FALSE, -- Nur für Trainer sichtbar

  -- Timestamps
  datum DATE NOT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,

  -- Indizes
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_datum (datum),
  INDEX idx_typ (typ)
);

-- =====================================================================================
-- 7. VIEWS FÜR REPORTING
-- =====================================================================================

-- Fortschritts-Übersicht pro Mitglied
CREATE OR REPLACE VIEW mitglied_fortschritt_overview AS
SELECT
    m.mitglied_id,
    CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
    COUNT(DISTINCT mf.fortschritt_id) as gesamt_skills,
    SUM(CASE WHEN mf.status = 'gemeistert' THEN 1 ELSE 0 END) as gemeisterte_skills,
    ROUND(AVG(mf.fortschritt_prozent), 2) as durchschnitt_fortschritt,
    COUNT(DISTINCT mz.ziel_id) as aktive_ziele,
    COUNT(DISTINCT mm.meilenstein_id) as erreichte_meilensteine
FROM mitglieder m
LEFT JOIN mitglieder_fortschritt mf ON m.mitglied_id = mf.mitglied_id
LEFT JOIN mitglieder_ziele mz ON m.mitglied_id = mz.mitglied_id AND mz.status = 'aktiv'
LEFT JOIN mitglieder_meilensteine mm ON m.mitglied_id = mm.mitglied_id AND mm.erreicht = TRUE
GROUP BY m.mitglied_id, m.vorname, m.nachname;

-- Top Performer View
CREATE OR REPLACE VIEW top_performer AS
SELECT
    m.mitglied_id,
    CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
    COUNT(CASE WHEN mf.status = 'gemeistert' THEN 1 END) as gemeisterte_skills,
    ROUND(AVG(mf.fortschritt_prozent), 2) as durchschnitt_fortschritt,
    COUNT(CASE WHEN mm.erreicht = TRUE THEN 1 END) as meilensteine
FROM mitglieder m
LEFT JOIN mitglieder_fortschritt mf ON m.mitglied_id = mf.mitglied_id
LEFT JOIN mitglieder_meilensteine mm ON m.mitglied_id = mm.mitglied_id
GROUP BY m.mitglied_id, m.vorname, m.nachname
HAVING gemeisterte_skills > 0
ORDER BY gemeisterte_skills DESC, durchschnitt_fortschritt DESC
LIMIT 10;

-- =====================================================================================
-- 8. DEMO-DATEN EINFÜGEN (Optional)
-- =====================================================================================

-- Beispiel Fortschritt für Mitglied ID 1 (falls vorhanden)
INSERT IGNORE INTO mitglieder_fortschritt (mitglied_id, kategorie_id, skill_name, beschreibung, fortschritt_prozent, status, prioritaet, schwierigkeit) VALUES
(1, 1, 'Grundschläge', 'Basis-Schlagtechniken: Jab, Cross, Hook, Uppercut', 75, 'in_arbeit', 'hoch', 'anfaenger'),
(1, 1, 'Fußtechniken', 'Kicks: Front-Kick, Roundhouse, Side-Kick', 50, 'in_arbeit', 'hoch', 'anfaenger'),
(1, 2, '50 Liegestütze am Stück', 'Kraftausdauer für Oberkörper', 60, 'in_arbeit', 'mittel', 'fortgeschritten'),
(1, 3, 'Spagat', 'Voller Spagat für bessere Beweglichkeit', 30, 'in_arbeit', 'mittel', 'fortgeschritten'),
(1, 4, 'Kata Heian Shodan', 'Erste Shotokan Kata beherrschen', 90, 'in_arbeit', 'hoch', 'anfaenger');

-- Beispiel Ziele
INSERT IGNORE INTO mitglieder_ziele (mitglied_id, titel, beschreibung, start_datum, ziel_datum, messbar, einheit, ziel_wert, aktueller_wert, status) VALUES
(1, 'Schwarzgurt erreichen', 'Bis Ende 2025 den Schwarzgurt (1. Dan) erreichen', '2025-01-01', '2025-12-31', FALSE, NULL, NULL, NULL, 'aktiv'),
(1, '100 Liegestütze', 'Schaffe 100 Liegestütze am Stück ohne Pause', '2025-01-15', '2025-06-30', TRUE, 'Stück', 100, 60, 'aktiv'),
(1, '5km laufen unter 25 Min', 'Verbessere Ausdauer durch Lauftraining', '2025-02-01', '2025-08-01', TRUE, 'Minuten', 25, 28, 'aktiv');

-- Beispiel Meilensteine
INSERT IGNORE INTO mitglieder_meilensteine (mitglied_id, titel, beschreibung, typ, erreicht, erreicht_am, oeffentlich) VALUES
(1, 'Erster Wettkampf', 'Teilnahme am ersten Turnier', 'turnier', TRUE, '2024-05-15', TRUE),
(1, 'Gelber Gürtel', 'Bestandene Prüfung zum gelben Gürtel', 'pruefung', TRUE, '2024-03-20', TRUE),
(1, '1 Jahr Training', 'Ein volles Jahr kontinuierliches Training', 'achievement', TRUE, '2024-01-10', TRUE),
(1, 'Grüner Gürtel', 'Nächste Gürtelprüfung bestehen', 'pruefung', FALSE, NULL, FALSE);

-- =====================================================================================
-- TRIGGER FÜR AUTOMATISCHE UPDATES
-- =====================================================================================

DELIMITER //

-- Trigger: Automatisches Update von gestartet_am
CREATE TRIGGER fortschritt_set_started_date
BEFORE UPDATE ON mitglieder_fortschritt
FOR EACH ROW
BEGIN
    -- Wenn Status von 'nicht_gestartet' zu 'in_arbeit' wechselt
    IF OLD.status = 'nicht_gestartet' AND NEW.status = 'in_arbeit' AND NEW.gestartet_am IS NULL THEN
        SET NEW.gestartet_am = CURDATE();
    END IF;

    -- Wenn Status zu 'gemeistert' wechselt
    IF OLD.status != 'gemeistert' AND NEW.status = 'gemeistert' AND NEW.gemeistert_am IS NULL THEN
        SET NEW.gemeistert_am = CURDATE();
        SET NEW.fortschritt_prozent = 100;
    END IF;
END//

-- Trigger: Fortschritts-History automatisch erstellen
CREATE TRIGGER fortschritt_create_history
AFTER UPDATE ON mitglieder_fortschritt
FOR EACH ROW
BEGIN
    -- Nur wenn sich Fortschritt oder Status geändert hat
    IF OLD.fortschritt_prozent != NEW.fortschritt_prozent OR OLD.status != NEW.status THEN
        INSERT INTO fortschritt_updates (
            fortschritt_id,
            mitglied_id,
            alter_fortschritt,
            neuer_fortschritt,
            alter_status,
            neuer_status
        ) VALUES (
            NEW.fortschritt_id,
            NEW.mitglied_id,
            OLD.fortschritt_prozent,
            NEW.fortschritt_prozent,
            OLD.status,
            NEW.status
        );
    END IF;
END//

-- Trigger: Ziel als erreicht markieren wenn 100%
CREATE TRIGGER ziel_auto_erreicht
BEFORE UPDATE ON mitglieder_ziele
FOR EACH ROW
BEGIN
    -- Wenn messbares Ziel erreicht wurde
    IF NEW.messbar = TRUE AND NEW.aktueller_wert >= NEW.ziel_wert THEN
        SET NEW.fortschritt_prozent = 100;
        SET NEW.status = 'erreicht';
        IF NEW.erreicht_am IS NULL THEN
            SET NEW.erreicht_am = CURDATE();
        END IF;
    END IF;

    -- Wenn Fortschritt 100% erreicht
    IF NEW.fortschritt_prozent = 100 AND OLD.status = 'aktiv' THEN
        SET NEW.status = 'erreicht';
        IF NEW.erreicht_am IS NULL THEN
            SET NEW.erreicht_am = CURDATE();
        END IF;
    END IF;
END//

DELIMITER ;

-- =====================================================================================
-- ERFOLGREICH ERSTELLT
-- =====================================================================================

SELECT 'Fortschritts-Tracking Tabellen erfolgreich erstellt!' as Status;
