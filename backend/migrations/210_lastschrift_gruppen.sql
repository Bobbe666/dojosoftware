-- Migration: Lastschrift-Gruppen
-- Erstellt: 2026-06-23
-- Beschreibung: Pro-Dojo definierbare Lastschrift-Gruppen mit festem Einzugstag.
--   Mitglieder werden einer Gruppe zugeordnet (mitglieder.zahllaufgruppe = gruppe_key)
--   und am Einzugstag der Gruppe automatisch eingezogen. Eigene Tabelle wegen
--   Row-Size-Limit auf mitglieder/dojo.

CREATE TABLE IF NOT EXISTS lastschrift_gruppen (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id         INT NOT NULL,
    gruppe_key      VARCHAR(50) NOT NULL,            -- stabiler Key, = mitglieder.zahllaufgruppe
    name            VARCHAR(100) NOT NULL,
    einzugstag      INT NOT NULL DEFAULT 1,          -- Tag im Monat (1-28, Februar-sicher)
    fenster_von     INT DEFAULT NULL,               -- fachliche Doku (z.B. 1)
    fenster_bis     INT DEFAULT NULL,               -- fachliche Doku (z.B. 14)
    typ             ENUM('periodisch','extra') NOT NULL DEFAULT 'periodisch',
    ist_standard    TINYINT(1) NOT NULL DEFAULT 0,   -- Default fuer neue Mitglieder (genau 1 pro Dojo)
    aktiv           TINYINT(1) NOT NULL DEFAULT 1,
    reihenfolge     INT NOT NULL DEFAULT 0,
    erstellt_am     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dojo_key (dojo_id, gruppe_key),
    INDEX idx_dojo_aktiv (dojo_id, aktiv),
    CONSTRAINT chk_einzugstag CHECK (einzugstag BETWEEN 1 AND 28),
    CONSTRAINT fk_lsgruppe_dojo FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default-Gruppen fuer jedes bestehende Dojo seeden (idempotent)
INSERT INTO lastschrift_gruppen
    (dojo_id, gruppe_key, name, einzugstag, fenster_von, fenster_bis, typ, ist_standard, reihenfolge)
SELECT d.id, 'monatsanfang', 'Monatsanfang', 1, 1, 14, 'periodisch', 1, 0 FROM dojo d
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO lastschrift_gruppen
    (dojo_id, gruppe_key, name, einzugstag, fenster_von, fenster_bis, typ, ist_standard, reihenfolge)
SELECT d.id, 'monatsmitte', 'Monatsmitte (Gruppe 2)', 15, 15, 28, 'periodisch', 0, 1 FROM dojo d
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO lastschrift_gruppen
    (dojo_id, gruppe_key, name, einzugstag, fenster_von, fenster_bis, typ, ist_standard, reihenfolge)
SELECT d.id, 'extra', 'Extra (Sonderfaelle/Jahreszahler)', 20, NULL, NULL, 'extra', 0, 2 FROM dojo d
ON DUPLICATE KEY UPDATE name = name;
