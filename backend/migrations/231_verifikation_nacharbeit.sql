-- Finale Cross-Tenant-Bereinigung (aus der Verifikations-Sweep).

-- #5: 5 Prüfungen von Dojo-3-Mitgliedern waren fälschlich unter Dojo 2 verbucht.
-- → Dojo 3 + Dojo-3-Enso (stil_id 5); Gürtel-Refs von Dojo-2-Enso auf gleichnamige
--   Dojo-3-Enso-Gürtel remappen (zwischen_id ist bei allen NULL).
UPDATE pruefungen p
SET p.dojo_id = 3,
    p.stil_id = 5,
    p.graduierung_vorher_id = (SELECT g3.graduierung_id FROM graduierungen g2
        JOIN graduierungen g3 ON g3.name = g2.name AND g3.stil_id = 5
        WHERE g2.graduierung_id = p.graduierung_vorher_id),
    p.graduierung_nachher_id = (SELECT g3.graduierung_id FROM graduierungen g2
        JOIN graduierungen g3 ON g3.name = g2.name AND g3.stil_id = 5
        WHERE g2.graduierung_id = p.graduierung_nachher_id)
WHERE p.pruefung_id IN (3,4,5,6,7);

-- #11: Dojo-2-Artikel hingen an Dojo-3-Kategorien. Dojo-2-Kopien der genutzten
-- (generischen, top-level) Kategorien anlegen und die Artikel darauf umhängen.
INSERT INTO artikelgruppen (name, beschreibung, parent_id, sortierung, aktiv, icon, farbe, dojo_id)
SELECT DISTINCT ag.name, ag.beschreibung, NULL, ag.sortierung, ag.aktiv, ag.icon, ag.farbe, 2
FROM artikelgruppen ag
JOIN artikel a ON a.kategorie_id = ag.id
WHERE a.dojo_id = 2 AND ag.dojo_id = 3;

UPDATE artikel a
JOIN artikelgruppen old ON old.id = a.kategorie_id AND old.dojo_id = 3
JOIN artikelgruppen neu ON neu.name = old.name AND neu.dojo_id = 2
SET a.kategorie_id = neu.id
WHERE a.dojo_id = 2;
