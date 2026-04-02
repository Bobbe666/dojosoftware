-- Migration 059: Konfigurierbare Prüfungsinhalte-Kategorien pro Stil
-- Datum: 2026-03-26
-- WICHTIG: Ausführen mit: mysql --default-character-set=utf8mb4 dojo < 059_...sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS pruefungsinhalte_kategorien (
  kategorie_id INT AUTO_INCREMENT PRIMARY KEY,
  stil_id INT NOT NULL,
  kategorie_key VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '📋',
  reihenfolge INT NOT NULL DEFAULT 0,
  aktiv TINYINT(1) NOT NULL DEFAULT 1,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stil_key (stil_id, kategorie_key),
  FOREIGN KEY (stil_id) REFERENCES stile(stil_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Bestehende Stile mit den 5 Standard-Kategorien befüllen (nur wenn noch keine vorhanden)
INSERT INTO pruefungsinhalte_kategorien (stil_id, kategorie_key, label, icon, reihenfolge)
SELECT s.stil_id, k.kategorie_key, k.label, k.icon, k.reihenfolge
FROM stile s
CROSS JOIN (
  SELECT 'kondition'      AS kategorie_key, 'Kondition / Warm Up'  AS label, '💪' AS icon, 1 AS reihenfolge UNION ALL
  SELECT 'grundtechniken',                  'Grundtechniken',               '🥋',           2               UNION ALL
  SELECT 'kata',                            'Kata / Kombinationen',         '🎭',           3               UNION ALL
  SELECT 'kumite',                          'Kumite / Sparring',            '⚔️',           4               UNION ALL
  SELECT 'theorie',                         'Theorie',                      '📚',           5
) k
WHERE NOT EXISTS (
  SELECT 1 FROM pruefungsinhalte_kategorien pk WHERE pk.stil_id = s.stil_id
);
