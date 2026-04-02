-- Migration: Manuelle Trainingsstunden und Badges
-- Ermoeglicht das manuelle Hinzufuegen von Trainingsstunden und Auszeichnungen

-- 1. Tabelle fuer manuelle Trainingsstunden-Anpassungen
CREATE TABLE IF NOT EXISTS manuelle_trainingsstunden (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL,
    stunden DECIMAL(5,2) NOT NULL DEFAULT 1.0 COMMENT 'Anzahl der Stunden',
    datum DATE NOT NULL COMMENT 'Datum der Trainingseinheit',
    grund VARCHAR(255) NOT NULL COMMENT 'Grund fuer die manuelle Eintragung',
    stil_id INT NULL COMMENT 'Optional: Zugehoeriger Stil',
    erstellt_von_id INT NULL COMMENT 'Admin der die Eintragung gemacht hat',
    erstellt_von_name VARCHAR(100) NULL,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
    FOREIGN KEY (stil_id) REFERENCES stile(stil_id) ON DELETE SET NULL,
    INDEX idx_mitglied_datum (mitglied_id, datum),
    INDEX idx_datum (datum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Badges/Auszeichnungen Tabelle
CREATE TABLE IF NOT EXISTS badges (
    badge_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    beschreibung TEXT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'award' COMMENT 'Lucide Icon Name',
    farbe VARCHAR(20) NOT NULL DEFAULT '#ffd700' COMMENT 'Hex Farbcode',
    kategorie ENUM('training', 'pruefung', 'skill', 'achievement', 'special') NOT NULL DEFAULT 'achievement',
    kriterium_typ ENUM('trainings_anzahl', 'streak', 'pruefung_bestanden', 'skill_gemeistert', 'manuell') NOT NULL DEFAULT 'manuell',
    kriterium_wert INT NULL COMMENT 'Z.B. 100 fuer 100 Trainings',
    aktiv BOOLEAN DEFAULT TRUE,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Mitglieder-Badges Zuordnung
CREATE TABLE IF NOT EXISTS mitglieder_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL,
    badge_id INT NOT NULL,
    verliehen_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verliehen_von_id INT NULL,
    verliehen_von_name VARCHAR(100) NULL,
    kommentar TEXT NULL,
    benachrichtigt BOOLEAN DEFAULT FALSE COMMENT 'E-Mail Benachrichtigung gesendet',

    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE CASCADE,
    UNIQUE KEY unique_mitglied_badge (mitglied_id, badge_id),
    INDEX idx_verliehen_am (verliehen_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Standard-Badges einfuegen
INSERT IGNORE INTO badges (name, beschreibung, icon, farbe, kategorie, kriterium_typ, kriterium_wert) VALUES
-- Training Badges
('Erste Schritte', 'Erstes Training absolviert', 'footprints', '#4ade80', 'training', 'trainings_anzahl', 1),
('Anfaenger', '10 Trainings absolviert', 'star', '#60a5fa', 'training', 'trainings_anzahl', 10),
('Engagiert', '25 Trainings absolviert', 'trending-up', '#a78bfa', 'training', 'trainings_anzahl', 25),
('Fleissig', '50 Trainings absolviert', 'zap', '#f97316', 'training', 'trainings_anzahl', 50),
('Veteran', '100 Trainings absolviert', 'medal', '#ffd700', 'training', 'trainings_anzahl', 100),
('Meister der Ausdauer', '250 Trainings absolviert', 'crown', '#ef4444', 'training', 'trainings_anzahl', 250),
('Legende', '500 Trainings absolviert', 'trophy', '#8b5cf6', 'training', 'trainings_anzahl', 500),

-- Streak Badges
('Durchhalter', '5 Trainings in Folge', 'flame', '#f97316', 'training', 'streak', 5),
('Konstant', '10 Trainings in Folge', 'flame', '#ef4444', 'training', 'streak', 10),
('Unaufhaltsam', '20 Trainings in Folge', 'flame', '#dc2626', 'training', 'streak', 20),

-- Pruefungs Badges
('Erste Pruefung', 'Erste Guertelpruefung bestanden', 'award', '#22c55e', 'pruefung', 'pruefung_bestanden', 1),
('Pruefungsprofi', '5 Pruefungen bestanden', 'award', '#3b82f6', 'pruefung', 'pruefung_bestanden', 5),
('Dan-Traeger', 'Schwarzgurt erreicht', 'shield', '#000000', 'pruefung', 'manuell', NULL),

-- Skill Badges
('Technik-Meister', 'Eine Technik gemeistert', 'target', '#8b5cf6', 'skill', 'skill_gemeistert', 1),
('Vielseitig', '5 Techniken gemeistert', 'layers', '#14b8a6', 'skill', 'skill_gemeistert', 5),
('Experte', '10 Techniken gemeistert', 'brain', '#f59e0b', 'skill', 'skill_gemeistert', 10),

-- Special Badges
('Vorbildlich', 'Besonderes Engagement gezeigt', 'heart', '#ec4899', 'special', 'manuell', NULL),
('Helfer', 'Hat anderen Schuelern geholfen', 'users', '#06b6d4', 'special', 'manuell', NULL),
('Turnierkaempfer', 'An einem Turnier teilgenommen', 'swords', '#f97316', 'special', 'manuell', NULL),
('Turnier-Sieger', 'Ein Turnier gewonnen', 'trophy', '#ffd700', 'special', 'manuell', NULL);
