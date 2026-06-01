-- ============================================================
-- Mojibake-Reparatur: doppelt-encodiertes UTF-8 in dokument_vorlagen
-- Symptom: "Vertragsverlängerung" → "VertragsverlÃ¤ngerung"
-- Filter HEX LIKE '%C383%' trifft nur kaputte Zeilen (Ã = C3 83),
-- korrekte ä (C3 A4) bleiben unberührt.
-- VOR dem Ausführen: Backup! (mysqldump dojo dokument_vorlagen > backup.sql)
-- ============================================================

UPDATE dokument_vorlagen SET name          = CONVERT(CAST(CONVERT(name USING latin1) AS BINARY) USING utf8mb4)          WHERE HEX(name) LIKE '%C383%';
UPDATE dokument_vorlagen SET email_betreff = CONVERT(CAST(CONVERT(email_betreff USING latin1) AS BINARY) USING utf8mb4) WHERE HEX(email_betreff) LIKE '%C383%';
UPDATE dokument_vorlagen SET email_html    = CONVERT(CAST(CONVERT(email_html USING latin1) AS BINARY) USING utf8mb4)    WHERE HEX(email_html) LIKE '%C383%';
UPDATE dokument_vorlagen SET brief_titel   = CONVERT(CAST(CONVERT(brief_titel USING latin1) AS BINARY) USING utf8mb4)   WHERE HEX(brief_titel) LIKE '%C383%';
UPDATE dokument_vorlagen SET brief_html    = CONVERT(CAST(CONVERT(brief_html USING latin1) AS BINARY) USING utf8mb4)    WHERE HEX(brief_html) LIKE '%C383%';

-- Kontrolle (muss 0 ergeben):
-- SELECT SUM(HEX(name) LIKE '%C383%') + SUM(HEX(email_betreff) LIKE '%C383%') + SUM(HEX(email_html) LIKE '%C383%')
--      + SUM(HEX(brief_titel) LIKE '%C383%') + SUM(HEX(brief_html) LIKE '%C383%') AS rest FROM dokument_vorlagen;
