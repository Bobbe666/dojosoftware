-- Phase 4: Verwaiste Shop-Artikel zuordnen.
-- 13 Artikel haben dojo_id=1 (alter DEFAULT-Wert), aber Dojo 1 existiert nicht →
-- sie sind aktuell keinem echten Dojo sichtbar. Sie gehören dem Dojo ihrer
-- Artikelkategorie (alle 13 → Kategorie gehört Dojo 3). Zuordnung über die Kategorie.
-- laufzeiten: KEINE Änderung (5 NULL-Zeilen = generische Defaults "1/3/6/12/24 Monate",
--   korrektes Override-Muster). rabatte: bereits sauber (1 Zeile Dojo 3, Query gefiltert).
UPDATE artikel a
  JOIN artikelgruppen ag ON ag.id = a.kategorie_id
   SET a.dojo_id = ag.dojo_id
 WHERE a.dojo_id = 1 AND ag.dojo_id IS NOT NULL;
