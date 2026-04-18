-- Migration 081: Gürtel-Artikel Seed
-- Erstellt für jede Gürtelfarbe einen Artikel mit Längen-Varianten (220–340cm)
-- Kategorie: 71 = Farbgürtel (unter 7 = Gürtel & Graduierung)
-- HINWEIS: farbe_hex muss ggf. an die tatsächlichen Graduierungsfarben in der DB angepasst werden

-- Sicherstellen, dass Varianten-Spalten in artikel existieren (MariaDB-Syntax)
ALTER TABLE artikel ADD COLUMN IF NOT EXISTS hat_varianten TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE artikel ADD COLUMN IF NOT EXISTS varianten_groessen JSON NULL DEFAULT NULL;
ALTER TABLE artikel ADD COLUMN IF NOT EXISTS varianten_bestand JSON NULL DEFAULT NULL;
ALTER TABLE artikel ADD COLUMN IF NOT EXISTS varianten_farben JSON NULL DEFAULT NULL;

-- Sicherstellen dass Kategorie 71 (Farbgürtel) existiert
INSERT IGNORE INTO artikel_kategorien (kategorie_id, name, parent_id)
VALUES (71, 'Farbgürtel', 7);

-- Varianten-Größen JSON (220–340cm in 20er Schritten)
SET @groessen = '["220","240","260","280","300","320","340"]';
-- Leerer Bestand (alle Größen 0)
SET @bestand_leer = '{"220":0,"240":0,"260":0,"280":0,"300":0,"320":0,"340":0}';

-- Weiß
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Weiß', 'Weißer Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#FFFFFF', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Weiß' AND kategorie_id = 71);

-- Weiß/Gelb
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Weiß/Gelb', 'Weiß-Gelber Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#FFFF80', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Weiß/Gelb' AND kategorie_id = 71);

-- Gelb
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Gelb', 'Gelber Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#FFD700', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Gelb' AND kategorie_id = 71);

-- Gelb/Grün
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Gelb/Grün', 'Gelb-Grüner Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#AADD00', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Gelb/Grün' AND kategorie_id = 71);

-- Orange
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Orange', 'Orangefarbener Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#FF8800', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Orange' AND kategorie_id = 71);

-- Grün
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Grün', 'Grüner Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#22AA44', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Grün' AND kategorie_id = 71);

-- Grün/Blau
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Grün/Blau', 'Grün-Blauer Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#2266AA', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Grün/Blau' AND kategorie_id = 71);

-- Blau
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Blau', 'Blauer Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#1144CC', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Blau' AND kategorie_id = 71);

-- Blau/Rot
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Blau/Rot', 'Blau-Roter Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#8833BB', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Blau/Rot' AND kategorie_id = 71);

-- Blau/Braun
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Blau/Braun', 'Blau-Brauner Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#557799', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Blau/Braun' AND kategorie_id = 71);

-- Braun
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Braun', 'Brauner Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#8B4513', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Braun' AND kategorie_id = 71);

-- Lila
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Lila', 'Lila Gürtel in Längen 220–340cm', 1500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#800080', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Lila' AND kategorie_id = 71);

-- Schwarz
INSERT INTO artikel (kategorie_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking, hat_varianten, varianten_groessen, varianten_bestand, farbe_hex, aktiv, sichtbar_kasse)
SELECT 71, 'Gürtel Schwarz', 'Schwarzer Gürtel in Längen 220–340cm', 2500, 19.00, 0, 1, 1, @groessen, @bestand_leer, '#111111', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM artikel WHERE name = 'Gürtel Schwarz' AND kategorie_id = 71);
