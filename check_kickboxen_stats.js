const mysql = require('./backend/node_modules/mysql2');
require('./backend/node_modules/dotenv').config({ path: './backend/.env' });

async function checkKickboxenStats() {
  const connection = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dojoUser',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'dojo'
  }).promise();

  try {
    console.log('=== Kickboxen (Stil ID 4) Statistik-Check ===\n');

    // 1. Alle Mitglieder mit stil_id = 4
    const [mitgliederStil] = await connection.query(`
      SELECT mitglied_id, vorname, nachname, stil_id, graduierung_id, aktiv
      FROM mitglieder
      WHERE stil_id = 4
    `);
    console.log('1. Mitglieder mit stil_id = 4:');
    console.table(mitgliederStil);

    // 2. Alle Graduierungen für Kickboxen
    const [graduierungen] = await connection.query(`
      SELECT graduierung_id, name, kategorie, reihenfolge, aktiv
      FROM graduierungen
      WHERE stil_id = 4
      ORDER BY reihenfolge
    `);
    console.log('\n2. Graduierungen für Kickboxen (stil_id = 4):');
    console.table(graduierungen);

    // 3. Aktuelle Statistik-Query (wie im Backend)
    const [stats] = await connection.query(`
      SELECT
        g.graduierung_id,
        g.name as graduierung,
        g.kategorie,
        COUNT(m.mitglied_id) as anzahl_mitglieder
      FROM graduierungen g
      LEFT JOIN mitglieder m ON g.graduierung_id = m.graduierung_id AND m.aktiv = 1
      WHERE g.stil_id = 4 AND g.aktiv = 1
      GROUP BY g.graduierung_id, g.name, g.kategorie
      ORDER BY g.reihenfolge ASC
    `);
    console.log('\n3. Aktuelle Statistik (Backend Query):');
    console.table(stats);

    // 4. Gesamt-Schüler Count
    const [totalCount] = await connection.query(`
      SELECT COUNT(*) as total
      FROM mitglieder
      WHERE stil_id = 4 AND aktiv = 1
    `);
    console.log('\n4. Gesamt Schüler mit stil_id = 4 und aktiv = 1:');
    console.log('Total:', totalCount[0].total);

    // 5. Detaillierte Analyse
    console.log('\n=== ANALYSE ===');
    const aktiveMitglieder = mitgliederStil.filter(m => m.aktiv === 1);
    console.log(`Aktive Mitglieder in Kickboxen: ${aktiveMitglieder.length}`);

    aktiveMitglieder.forEach(m => {
      const grad = graduierungen.find(g => g.graduierung_id === m.graduierung_id);
      console.log(`- ${m.vorname} ${m.nachname}: graduierung_id=${m.graduierung_id}${grad ? ` (${grad.name})` : ' (KEINE GRADUIERUNG GEFUNDEN!)'}`);
    });

  } catch (error) {
    console.error('Fehler:', error);
  } finally {
    await connection.end();
  }
}

checkKickboxenStats();
