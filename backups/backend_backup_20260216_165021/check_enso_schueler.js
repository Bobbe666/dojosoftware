const db = require('./db');

console.log('\n====== ENSO KARATE SCHÜLER-CHECK ======\n');

// Schüler für Enso Karate (Stil-ID 5) abfragen
const query = `
  SELECT
    m.mitglied_id,
    m.vorname,
    m.nachname,
    m.stil_id,
    m.graduierung_id,
    g.name as gurt_name,
    g.farbe_hex
  FROM mitglieder m
  LEFT JOIN graduierungen g ON m.graduierung_id = g.graduierung_id
  WHERE m.stil_id = 5 AND m.aktiv = 1
  ORDER BY m.nachname, m.vorname
`;

db.query(query, (err, results) => {
  if (err) {
    console.error('❌ Fehler bei der Abfrage:', err);
    process.exit(1);
  }

  console.log(`Gefundene Schüler: ${results.length}\n`);

  results.forEach((schueler, idx) => {
    console.log(`${idx + 1}. ${schueler.nachname}, ${schueler.vorname}`);
    console.log(`   Mitglied-ID: ${schueler.mitglied_id}`);
    console.log(`   Stil-ID: ${schueler.stil_id}`);
    console.log(`   Graduierung-ID: ${schueler.graduierung_id || 'NICHT GESETZT'}`);
    console.log(`   Gürtel: ${schueler.gurt_name || 'KEIN GÜRTEL'}`);
    console.log(`   Farbe: ${schueler.farbe_hex || 'N/A'}`);
    console.log('');
  });

  console.log('====================================\n');

  // Verfügbare Gürtel für Enso Karate anzeigen
  const gurtQuery = `
    SELECT graduierung_id, name, farbe_hex, reihenfolge
    FROM graduierungen
    WHERE stil_id = 5 AND aktiv = 1
    ORDER BY reihenfolge
  `;

  db.query(gurtQuery, (gurtErr, gurtResults) => {
    if (gurtErr) {
      console.error('❌ Fehler beim Laden der Gürtel:', gurtErr);
      process.exit(1);
    }

    console.log('Verfügbare Gürtel für Enso Karate:\n');
    gurtResults.forEach((gurt, idx) => {
      console.log(`${idx + 1}. ${gurt.name} (ID: ${gurt.graduierung_id}) - Farbe: ${gurt.farbe_hex}`);
    });
    console.log('\n====================================\n');

    process.exit(0);
  });
});
