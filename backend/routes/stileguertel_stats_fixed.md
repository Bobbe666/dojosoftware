// Nur die korrigierten Queries - zum Einfügen

// Graduierungs-Statistiken Query (Zeile 1118-1132)
const graduierungStatsQuery = `
  SELECT
    g.name as graduierung,
    g.farbe_hex,
    g.farbe_sekundaer,
    g.kategorie,
    g.dan_grad,
    g.reihenfolge,
    COUNT(DISTINCT CASE
      WHEN m.gurtfarbe = g.name
      AND (m.stile LIKE CONCAT('%', (SELECT name FROM stile WHERE stil_id = ?), '%'))
      AND m.aktiv = 1
      THEN m.mitglied_id
    END) as anzahl_mitglieder
  FROM graduierungen g
  LEFT JOIN mitglieder m ON 1=1
  WHERE g.stil_id = ? AND g.aktiv = 1
  GROUP BY g.graduierung_id, g.name, g.farbe_hex, g.farbe_sekundaer, g.kategorie, g.dan_grad, g.reihenfolge
  ORDER BY g.reihenfolge ASC
`;

// Query-Aufruf (Zeile 1134) - stilId ZWEIMAL übergeben!
connection.query(graduierungStatsQuery, [stilId, stilId], (graduierungError, graduierungStats) => {
