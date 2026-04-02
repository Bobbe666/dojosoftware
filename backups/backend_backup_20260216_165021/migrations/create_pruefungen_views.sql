-- ============================================================================
-- VIEWS FÜR PRÜFUNGSVERWALTUNG
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
INNER JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id;

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
