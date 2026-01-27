-- ============================================================================
-- PRÜFUNGEN SYSTEM - MODERNISIERTE VERSION
-- Erweiterte Gurtprüfungs-Verwaltung mit Graduierungen
-- ============================================================================

-- Prüfungen-Tabelle mit modernem Schema (verwendet graduierungen statt guertel)
DROP TABLE IF EXISTS pruefungen;
CREATE TABLE pruefungen (
  pruefung_id INT AUTO_INCREMENT PRIMARY KEY,

  -- Grunddaten
  mitglied_id INT NOT NULL COMMENT 'Mitglied, das geprüft wurde',
  stil_id INT NOT NULL COMMENT 'Stil, in dem die Prüfung stattfand',
  dojo_id INT NOT NULL COMMENT 'Dojo, in dem die Prüfung stattfand',

  -- Graduierungen (ersetzt alte guertel-Referenzen)
  graduierung_vorher_id INT NULL COMMENT 'Graduierung vor der Prüfung (NULL bei erster Prüfung)',
  graduierung_nachher_id INT NOT NULL COMMENT 'Angestrebte/erreichte Graduierung',

  -- Prüfungsdetails
  pruefungsdatum DATE NOT NULL COMMENT 'Datum der Prüfung',
  pruefungsort VARCHAR(200) NULL COMMENT 'Ort der Prüfung (falls abweichend vom Dojo)',

  -- Ergebnis
  bestanden BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Prüfung bestanden?',
  punktzahl DECIMAL(5,2) NULL COMMENT 'Erreichte Punktzahl (optional)',
  max_punktzahl DECIMAL(5,2) NULL COMMENT 'Maximal mögliche Punktzahl (optional)',

  -- Prüfer & Bewertung
  pruefer_id INT NULL COMMENT 'Hauptprüfer (Referenz auf mitglieder oder trainer)',
  prueferkommentar TEXT NULL COMMENT 'Kommentar des Prüfers',

  -- Finanzielle Daten
  pruefungsgebuehr DECIMAL(10,2) NULL COMMENT 'Prüfungsgebühr',
  gebuehr_bezahlt BOOLEAN DEFAULT FALSE COMMENT 'Gebühr bezahlt?',
  bezahldatum DATE NULL COMMENT 'Datum der Bezahlung',

  -- Urkunde & Dokumente
  urkunde_ausgestellt BOOLEAN DEFAULT FALSE COMMENT 'Urkunde ausgestellt?',
  urkunde_nr VARCHAR(100) NULL COMMENT 'Urkunden-Nummer',
  urkunde_pfad VARCHAR(500) NULL COMMENT 'Pfad zur Urkunden-PDF',
  dokumente_pfad VARCHAR(500) NULL COMMENT 'Pfad zu weiteren Dokumenten',

  -- Prüfungsinhalte (JSON oder separate Tabelle möglich)
  pruefungsinhalte JSON NULL COMMENT 'Detaillierte Prüfungsinhalte als JSON',
  einzelbewertungen JSON NULL COMMENT 'Einzelbewertungen als JSON (Kata, Kumite, etc.)',

  -- Status & Metadaten
  status ENUM('geplant', 'durchgefuehrt', 'bestanden', 'nicht_bestanden', 'abgesagt')
    DEFAULT 'geplant' COMMENT 'Prüfungsstatus',
  anmerkungen TEXT NULL COMMENT 'Allgemeine Anmerkungen',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Erstellungszeitpunkt',
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Letzte Änderung',
  erstellt_von INT NULL COMMENT 'Benutzer, der den Eintrag erstellt hat',

  -- Foreign Keys
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  FOREIGN KEY (stil_id) REFERENCES stile(stil_id) ON DELETE RESTRICT,
  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE RESTRICT,
  FOREIGN KEY (graduierung_vorher_id) REFERENCES graduierungen(graduierung_id) ON DELETE SET NULL,
  FOREIGN KEY (graduierung_nachher_id) REFERENCES graduierungen(graduierung_id) ON DELETE RESTRICT,

  -- Indizes für Performance
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_stil (stil_id),
  INDEX idx_dojo (dojo_id),
  INDEX idx_datum (pruefungsdatum),
  INDEX idx_status (status),
  INDEX idx_bestanden (bestanden),
  INDEX idx_graduierung_nachher (graduierung_nachher_id),

  -- Kombinierte Indizes für häufige Abfragen
  INDEX idx_mitglied_stil (mitglied_id, stil_id),
  INDEX idx_mitglied_datum (mitglied_id, pruefungsdatum),
  INDEX idx_stil_datum (stil_id, pruefungsdatum)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Erweiterte Prüfungsverwaltung mit Graduierungen';

-- ============================================================================
-- PRÜFUNGS-TEILNEHMER TABELLE (für Gruppenprüfungen)
-- ============================================================================

DROP TABLE IF EXISTS pruefung_teilnehmer;
CREATE TABLE pruefung_teilnehmer (
  id INT AUTO_INCREMENT PRIMARY KEY,

  pruefung_id INT NOT NULL COMMENT 'Referenz zur Prüfung',
  mitglied_id INT NOT NULL COMMENT 'Teilnehmendes Mitglied',

  angemeldet_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Anmeldezeitpunkt',
  status ENUM('angemeldet', 'teilgenommen', 'abwesend', 'abgesagt') DEFAULT 'angemeldet',

  -- Individual-Ergebnis für Gruppenprüfungen
  bestanden BOOLEAN NULL COMMENT 'Individuelles Ergebnis',
  punktzahl DECIMAL(5,2) NULL COMMENT 'Individuelle Punktzahl',
  kommentar TEXT NULL COMMENT 'Individueller Kommentar',

  FOREIGN KEY (pruefung_id) REFERENCES pruefungen(pruefung_id) ON DELETE CASCADE,
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,

  UNIQUE KEY unique_pruefung_mitglied (pruefung_id, mitglied_id),
  INDEX idx_pruefung (pruefung_id),
  INDEX idx_mitglied (mitglied_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Teilnehmer bei Gruppenprüfungen';

-- ============================================================================
-- PRÜFUNGS-ANFORDERUNGEN TABELLE
-- ============================================================================

DROP TABLE IF EXISTS pruefung_anforderungen;
CREATE TABLE pruefung_anforderungen (
  id INT AUTO_INCREMENT PRIMARY KEY,

  graduierung_id INT NOT NULL COMMENT 'Graduierung, für die die Anforderung gilt',
  stil_id INT NOT NULL COMMENT 'Stil',

  -- Anforderungstyp
  anforderungstyp ENUM('technik', 'kata', 'kumite', 'theorie', 'fitness', 'sonstiges')
    NOT NULL COMMENT 'Art der Anforderung',

  -- Anforderungsdetails
  bezeichnung VARCHAR(200) NOT NULL COMMENT 'Name/Bezeichnung der Anforderung',
  beschreibung TEXT NULL COMMENT 'Detaillierte Beschreibung',

  -- Bewertung
  min_punktzahl DECIMAL(5,2) NULL COMMENT 'Mindest-Punktzahl zum Bestehen',
  max_punktzahl DECIMAL(5,2) NULL COMMENT 'Maximal erreichbare Punktzahl',
  gewichtung DECIMAL(5,2) DEFAULT 1.0 COMMENT 'Gewichtung bei Gesamtbewertung',

  -- Reihenfolge
  reihenfolge INT DEFAULT 0 COMMENT 'Reihenfolge bei der Prüfung',

  -- Metadaten
  pflichtanforderung BOOLEAN DEFAULT TRUE COMMENT 'Muss erfüllt werden?',
  aktiv BOOLEAN DEFAULT TRUE COMMENT 'Anforderung aktiv?',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (graduierung_id) REFERENCES graduierungen(graduierung_id) ON DELETE CASCADE,
  FOREIGN KEY (stil_id) REFERENCES stile(stil_id) ON DELETE CASCADE,

  INDEX idx_graduierung (graduierung_id),
  INDEX idx_stil (stil_id),
  INDEX idx_typ (anforderungstyp),
  INDEX idx_aktiv (aktiv)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Anforderungen für Gürtelprüfungen';

-- ============================================================================
-- VIEWS FÜR EINFACHE ABFRAGEN
-- ============================================================================

-- View: Prüfungshistorie mit allen Details
CREATE OR REPLACE VIEW v_pruefungshistorie AS
SELECT
  p.pruefung_id,
  p.pruefungsdatum,
  p.bestanden,
  p.status,

  -- Mitglied
  m.mitglied_id,
  m.vorname,
  m.nachname,
  m.email,

  -- Stil
  s.stil_id,
  s.name as stil_name,

  -- Dojo
  d.id as dojo_id,
  d.dojoname,

  -- Graduierungen
  g_vorher.graduierung_id as graduierung_vorher_id,
  g_vorher.name as graduierung_vorher,
  g_vorher.farbe_hex as farbe_vorher,

  g_nachher.graduierung_id as graduierung_nachher_id,
  g_nachher.name as graduierung_nachher,
  g_nachher.farbe_hex as farbe_nachher,
  g_nachher.dan_grad,

  -- Bewertung
  p.punktzahl,
  p.max_punktzahl,
  CASE
    WHEN p.max_punktzahl > 0 THEN ROUND((p.punktzahl / p.max_punktzahl) * 100, 2)
    ELSE NULL
  END as prozent,

  -- Finanzen
  p.pruefungsgebuehr,
  p.gebuehr_bezahlt,
  p.bezahldatum,

  -- Urkunde
  p.urkunde_ausgestellt,
  p.urkunde_nr,

  -- Metadaten
  p.erstellt_am,
  p.aktualisiert_am

FROM pruefungen p
INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
INNER JOIN stile s ON p.stil_id = s.stil_id
INNER JOIN dojo d ON p.dojo_id = d.id
LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
ORDER BY p.pruefungsdatum DESC;

-- View: Anstehende Prüfungen
CREATE OR REPLACE VIEW v_anstehende_pruefungen AS
SELECT
  p.pruefung_id,
  p.pruefungsdatum,
  DATEDIFF(p.pruefungsdatum, CURDATE()) as tage_bis_pruefung,

  m.mitglied_id,
  m.vorname,
  m.nachname,
  m.email,

  s.name as stil_name,
  g.name as angestrebte_graduierung,
  g.farbe_hex,
  g.dan_grad,

  p.pruefungsgebuehr,
  p.gebuehr_bezahlt,

  p.status

FROM pruefungen p
INNER JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
INNER JOIN stile s ON p.stil_id = s.stil_id
INNER JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
WHERE p.status = 'geplant'
  AND p.pruefungsdatum >= CURDATE()
ORDER BY p.pruefungsdatum ASC;

-- ============================================================================
-- DEMO-DATEN (optional, nur für Test/Entwicklung)
-- ============================================================================

-- Beispiel: Prüfungsanforderungen für erste Graduierungen
-- (Auskommentiert, nur bei Bedarf ausführen)
/*
INSERT INTO pruefung_anforderungen (graduierung_id, stil_id, anforderungstyp, bezeichnung, beschreibung, min_punktzahl, max_punktzahl, reihenfolge)
SELECT
  g.graduierung_id,
  g.stil_id,
  'kata',
  CONCAT('Kata für ', g.name),
  'Grundlegende Kata-Form korrekt ausführen',
  6.0,
  10.0,
  1
FROM graduierungen g
WHERE g.kategorie = 'grundstufe'
ORDER BY g.stil_id, g.reihenfolge;
*/

SELECT 'Prüfungs-Tabellen erfolgreich erstellt!' as Status;
