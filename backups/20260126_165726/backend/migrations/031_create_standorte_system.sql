-- ===================================================================
-- Migration 031: Multi-Standort-Verwaltung (Multi-Location Management)
-- ===================================================================
-- Erstellt neue standorte Tabelle für Filial-Verwaltung
-- Fügt standort_id zu kurse, raeume, stundenplan hinzu
-- Erstellt Standard-Standorte für bestehende Dojos
-- Verknüpft bestehende Daten mit Standard-Standorten
-- ===================================================================

-- ===================================================================
-- Schritt 1: standorte Tabelle erstellen
-- ===================================================================
CREATE TABLE IF NOT EXISTS standorte (
    standort_id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL COMMENT 'Welchem Tenant/Dojo gehört dieser Standort',

    -- Basis-Info
    name VARCHAR(200) NOT NULL COMMENT 'Standort-Name (z.B. "Hauptstandort", "Filiale Nord")',
    ist_hauptstandort BOOLEAN DEFAULT FALSE COMMENT 'Ist dies der Hauptstandort?',
    sortierung INT DEFAULT 0 COMMENT 'Sortierreihenfolge für UI',
    farbe VARCHAR(7) DEFAULT '#4F46E5' COMMENT 'Farbe für UI-Identifikation',

    -- Adresse & Kontakt
    strasse VARCHAR(255),
    hausnummer VARCHAR(20),
    plz VARCHAR(10),
    ort VARCHAR(100),
    land VARCHAR(100) DEFAULT 'Deutschland',
    telefon VARCHAR(50),
    email VARCHAR(255),

    -- Öffnungszeiten (JSON Format für Flexibilität)
    oeffnungszeiten JSON COMMENT 'Öffnungszeiten pro Wochentag + Ausnahmen',

    -- Status
    ist_aktiv BOOLEAN DEFAULT TRUE,
    notizen TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_standorte_dojo_id (dojo_id),
    INDEX idx_standorte_aktiv (ist_aktiv),
    INDEX idx_standorte_sortierung (sortierung),
    INDEX idx_standorte_hauptstandort (ist_hauptstandort),

    -- Foreign Keys
    CONSTRAINT fk_standorte_dojo
        FOREIGN KEY (dojo_id) REFERENCES dojo(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Constraints
    CONSTRAINT chk_standorte_farbe CHECK (farbe REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Standorte/Filialen eines Dojos für Multi-Location Management';

-- ===================================================================
-- Schritt 2: trainer_standorte Tabelle erstellen (M:N Junction)
-- ===================================================================
CREATE TABLE IF NOT EXISTS trainer_standorte (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trainer_id INT NOT NULL,
    standort_id INT NOT NULL,
    ist_hauptstandort BOOLEAN DEFAULT FALSE COMMENT 'Ist dies der Hauptstandort des Trainers?',
    aktiv BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_trainer_standorte_trainer (trainer_id),
    INDEX idx_trainer_standorte_standort (standort_id),
    INDEX idx_trainer_standorte_aktiv (aktiv),

    -- Unique Constraint: Ein Trainer kann nur einmal pro Standort zugeordnet sein
    UNIQUE KEY unique_trainer_standort (trainer_id, standort_id),

    -- Foreign Keys
    CONSTRAINT fk_trainer_standorte_trainer
        FOREIGN KEY (trainer_id) REFERENCES trainer(trainer_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_trainer_standorte_standort
        FOREIGN KEY (standort_id) REFERENCES standorte(standort_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='M:N Zuordnung von Trainern zu Standorten';

-- ===================================================================
-- Schritt 3: standort_id Spalte zu kurse Tabelle hinzufügen
-- ===================================================================
-- Prüfe ob Spalte bereits existiert, dann nur Index hinzufügen
SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'kurse'
                     AND COLUMN_NAME = 'standort_id');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE kurse ADD COLUMN standort_id INT NULL AFTER dojo_id',
    'SELECT "Column kurse.standort_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index hinzufügen (nur wenn nicht existiert)
SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'kurse'
                     AND INDEX_NAME = 'idx_kurse_standort_id');

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE kurse ADD INDEX idx_kurse_standort_id (standort_id)',
    'SELECT "Index idx_kurse_standort_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign Key für kurse.standort_id (nur wenn noch nicht existiert)
SET @fk_exists = (SELECT COUNT(*)
                  FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'kurse'
                    AND CONSTRAINT_NAME = 'fk_kurse_standort');

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE kurse ADD CONSTRAINT fk_kurse_standort
     FOREIGN KEY (standort_id) REFERENCES standorte(standort_id)
     ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "FK fk_kurse_standort already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- Schritt 4: standort_id + dojo_id Spalten zu raeume Tabelle hinzufügen
-- ===================================================================
-- Prüfe und füge standort_id hinzu
SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'raeume'
                     AND COLUMN_NAME = 'standort_id');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE raeume ADD COLUMN standort_id INT NULL AFTER id',
    'SELECT "Column raeume.standort_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Prüfe und füge dojo_id hinzu
SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'raeume'
                     AND COLUMN_NAME = 'dojo_id');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE raeume ADD COLUMN dojo_id INT NULL AFTER standort_id',
    'SELECT "Column raeume.dojo_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Indexes hinzufügen
SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'raeume'
                     AND INDEX_NAME = 'idx_raeume_standort_id');

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE raeume ADD INDEX idx_raeume_standort_id (standort_id)',
    'SELECT "Index idx_raeume_standort_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'raeume'
                     AND INDEX_NAME = 'idx_raeume_dojo_id');

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE raeume ADD INDEX idx_raeume_dojo_id (dojo_id)',
    'SELECT "Index idx_raeume_dojo_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign Keys für raeume (nur wenn noch nicht existent)
SET @fk_raeume_standort = (SELECT COUNT(*)
                           FROM information_schema.TABLE_CONSTRAINTS
                           WHERE CONSTRAINT_SCHEMA = DATABASE()
                             AND TABLE_NAME = 'raeume'
                             AND CONSTRAINT_NAME = 'fk_raeume_standort');

SET @sql = IF(@fk_raeume_standort = 0,
    'ALTER TABLE raeume ADD CONSTRAINT fk_raeume_standort
     FOREIGN KEY (standort_id) REFERENCES standorte(standort_id)
     ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "FK fk_raeume_standort already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- Schritt 5: standort_id Spalte zu stundenplan Tabelle hinzufügen
-- ===================================================================
-- Prüfe ob Spalte bereits existiert
SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'stundenplan'
                     AND COLUMN_NAME = 'standort_id');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE stundenplan ADD COLUMN standort_id INT NULL AFTER kurs_id',
    'SELECT "Column stundenplan.standort_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index hinzufügen (nur wenn nicht existiert)
SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'stundenplan'
                     AND INDEX_NAME = 'idx_stundenplan_standort_id');

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE stundenplan ADD INDEX idx_stundenplan_standort_id (standort_id)',
    'SELECT "Index idx_stundenplan_standort_id already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign Key für stundenplan.standort_id
SET @fk_stundenplan_standort = (SELECT COUNT(*)
                                FROM information_schema.TABLE_CONSTRAINTS
                                WHERE CONSTRAINT_SCHEMA = DATABASE()
                                  AND TABLE_NAME = 'stundenplan'
                                  AND CONSTRAINT_NAME = 'fk_stundenplan_standort');

SET @sql = IF(@fk_stundenplan_standort = 0,
    'ALTER TABLE stundenplan ADD CONSTRAINT fk_stundenplan_standort
     FOREIGN KEY (standort_id) REFERENCES standorte(standort_id)
     ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "FK fk_stundenplan_standort already exists" AS info');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- Schritt 6: Standard-Standorte für bestehende Dojos erstellen
-- ===================================================================
-- Für jedes aktive Dojo wird ein Hauptstandort mit den Dojo-Stammdaten erstellt
INSERT INTO standorte (
    dojo_id,
    name,
    ist_hauptstandort,
    sortierung,
    ist_aktiv,
    strasse,
    hausnummer,
    plz,
    ort,
    land,
    telefon,
    email,
    farbe
)
SELECT
    d.id,
    CONCAT(d.dojoname, ' - Hauptstandort') as name,
    TRUE as ist_hauptstandort,
    0 as sortierung,
    TRUE as ist_aktiv,
    d.strasse,
    d.hausnummer,
    d.plz,
    d.ort,
    d.land,
    d.telefon,
    d.email,
    COALESCE(d.farbe, '#DAA520') as farbe
FROM dojo d
WHERE d.ist_aktiv = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM standorte s
      WHERE s.dojo_id = d.id
        AND s.ist_hauptstandort = TRUE
  );

-- ===================================================================
-- Schritt 7: Bestehende Kurse mit Hauptstandort verknüpfen
-- ===================================================================
UPDATE kurse k
INNER JOIN standorte s ON k.dojo_id = s.dojo_id
SET k.standort_id = s.standort_id
WHERE s.ist_hauptstandort = TRUE
  AND k.standort_id IS NULL;

-- ===================================================================
-- Schritt 8: Bestehende Räume mit Hauptstandort und Dojo verknüpfen
-- ===================================================================
-- Wenn raeume aktuell keine dojo_id haben, verknüpfe mit erstem Standort
UPDATE raeume r
LEFT JOIN standorte s ON s.ist_hauptstandort = TRUE
SET r.standort_id = s.standort_id,
    r.dojo_id = s.dojo_id
WHERE r.dojo_id IS NULL
  AND r.standort_id IS NULL
  AND s.standort_id IS NOT NULL;

-- ===================================================================
-- Schritt 9: Stundenplan-Einträge mit Standort verknüpfen (via Kurs)
-- ===================================================================
UPDATE stundenplan sp
INNER JOIN kurse k ON sp.kurs_id = k.kurs_id
SET sp.standort_id = k.standort_id
WHERE k.standort_id IS NOT NULL
  AND sp.standort_id IS NULL;

-- ===================================================================
-- Validierung: Datenintegrität prüfen
-- ===================================================================
-- Zähle Dojos ohne Hauptstandort (sollte 0 sein)
SELECT
    COUNT(DISTINCT d.id) as dojos_ohne_hauptstandort,
    'WARNUNG: Diese Dojos haben keinen Hauptstandort!' as hinweis
FROM dojo d
LEFT JOIN standorte s ON d.id = s.dojo_id AND s.ist_hauptstandort = TRUE
WHERE d.ist_aktiv = TRUE
  AND s.standort_id IS NULL
HAVING dojos_ohne_hauptstandort > 0;

-- Zähle Kurse ohne Standort (sollte niedrig sein)
SELECT
    COUNT(*) as kurse_ohne_standort,
    'INFO: Diese Kurse haben noch keinen Standort zugeordnet' as hinweis
FROM kurse
WHERE dojo_id IS NOT NULL
  AND standort_id IS NULL;

-- Zähle Räume ohne Standort
SELECT
    COUNT(*) as raeume_ohne_standort,
    'INFO: Diese Räume haben noch keinen Standort zugeordnet' as hinweis
FROM raeume
WHERE dojo_id IS NOT NULL
  AND standort_id IS NULL;

-- Statistik: Standorte pro Dojo
SELECT
    d.dojoname,
    COUNT(s.standort_id) as anzahl_standorte,
    SUM(CASE WHEN s.ist_hauptstandort THEN 1 ELSE 0 END) as hauptstandorte
FROM dojo d
LEFT JOIN standorte s ON d.id = s.dojo_id
WHERE d.ist_aktiv = TRUE
GROUP BY d.id, d.dojoname
ORDER BY anzahl_standorte DESC;

-- ===================================================================
-- ✅ Migration 031 abgeschlossen
-- ===================================================================
-- Multi-Standort-System ist jetzt einsatzbereit!
-- Nächste Schritte:
-- 1. Backend API implementieren (backend/routes/standorte.js)
-- 2. Frontend Context erstellen (frontend/src/context/StandortContext.jsx)
-- 3. UI-Komponenten implementieren
-- ===================================================================
