const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'dojo',
    multipleStatements: true
  });

  try {
    console.log('🔄 Starte Migration 031: Multi-Standort-System...\n');

    // Migration SQL-Datei laden
    const migrationPath = path.join(__dirname, '../migrations/031_create_standorte_system.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    // SQL in einzelne Statements aufteilen (für besseres Error-Handling)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 ${statements.length} SQL-Statements gefunden\n`);

    // Migration ausführen
    console.log('⚙️  Führe Migration aus...\n');
    await connection.query(migrationSQL);

    console.log('✅ Migration erfolgreich ausgeführt!\n');

    // Validierung durchführen
    console.log('🔍 Validiere Datenintegrität...\n');

    // 1. Prüfe ob standorte Tabelle existiert
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'standorte'
    `);
    console.log(tables.length > 0 ? '✅ Tabelle standorte existiert' : '❌ Tabelle standorte fehlt!');

    // 2. Prüfe ob trainer_standorte Tabelle existiert
    const [junctionTables] = await connection.query(`
      SHOW TABLES LIKE 'trainer_standorte'
    `);
    console.log(junctionTables.length > 0 ? '✅ Tabelle trainer_standorte existiert' : '❌ Tabelle trainer_standorte fehlt!');

    // 3. Prüfe ob standort_id Spalten hinzugefügt wurden
    const [kurseColumns] = await connection.query(`
      SHOW COLUMNS FROM kurse LIKE 'standort_id'
    `);
    console.log(kurseColumns.length > 0 ? '✅ kurse.standort_id existiert' : '❌ kurse.standort_id fehlt!');

    const [raeumeColumns] = await connection.query(`
      SHOW COLUMNS FROM raeume LIKE 'standort_id'
    `);
    console.log(raeumeColumns.length > 0 ? '✅ raeume.standort_id existiert' : '❌ raeume.standort_id fehlt!');

    const [stundenplanColumns] = await connection.query(`
      SHOW COLUMNS FROM stundenplan LIKE 'standort_id'
    `);
    console.log(stundenplanColumns.length > 0 ? '✅ stundenplan.standort_id existiert' : '❌ stundenplan.standort_id fehlt!');

    // 4. Zähle erstellte Standorte
    const [standorteCount] = await connection.query(`
      SELECT COUNT(*) as anzahl FROM standorte
    `);
    console.log(`\n📊 Standorte erstellt: ${standorteCount[0].anzahl}`);

    // 5. Zähle Hauptstandorte
    const [hauptstandorteCount] = await connection.query(`
      SELECT COUNT(*) as anzahl FROM standorte WHERE ist_hauptstandort = TRUE
    `);
    console.log(`📊 Hauptstandorte: ${hauptstandorteCount[0].anzahl}`);

    // 6. Zähle verknüpfte Kurse
    const [kurseLinked] = await connection.query(`
      SELECT COUNT(*) as anzahl FROM kurse WHERE standort_id IS NOT NULL
    `);
    console.log(`📊 Kurse mit Standort: ${kurseLinked[0].anzahl}`);

    // 7. Zähle verknüpfte Räume
    const [raeumeLinked] = await connection.query(`
      SELECT COUNT(*) as anzahl FROM raeume WHERE standort_id IS NOT NULL
    `);
    console.log(`📊 Räume mit Standort: ${raeumeLinked[0].anzahl}`);

    // 8. Zähle verknüpfte Stundenplan-Einträge
    const [stundenplanLinked] = await connection.query(`
      SELECT COUNT(*) as anzahl FROM stundenplan WHERE standort_id IS NOT NULL
    `);
    console.log(`📊 Stundenplan-Einträge mit Standort: ${stundenplanLinked[0].anzahl}`);

    // 9. Detaillierte Standort-Übersicht
    console.log('\n📋 Standort-Übersicht pro Dojo:');
    console.log('═'.repeat(80));
    const [standortDetails] = await connection.query(`
      SELECT
        d.dojoname,
        s.name as standort_name,
        s.ist_hauptstandort,
        s.ist_aktiv,
        COUNT(DISTINCT k.kurs_id) as anzahl_kurse,
        COUNT(DISTINCT r.id) as anzahl_raeume
      FROM dojo d
      LEFT JOIN standorte s ON d.id = s.dojo_id
      LEFT JOIN kurse k ON s.standort_id = k.standort_id
      LEFT JOIN raeume r ON s.standort_id = r.standort_id
      WHERE d.ist_aktiv = TRUE
      GROUP BY d.id, s.standort_id
      ORDER BY d.dojoname, s.ist_hauptstandort DESC, s.name
    `);

    standortDetails.forEach(detail => {
      const hauptBadge = detail.ist_hauptstandort ? '[HAUPT]' : '';
      const aktivBadge = detail.ist_aktiv ? '' : '[INAKTIV]';
      console.log(`  ${detail.dojoname}: ${detail.standort_name || '(kein Standort)'} ${hauptBadge}${aktivBadge}`);
      if (detail.standort_name) {
        console.log(`    → ${detail.anzahl_kurse} Kurse, ${detail.anzahl_raeume} Räume`);
      }
    });
    console.log('═'.repeat(80));

    // 10. Warnungen ausgeben
    console.log('\n⚠️  Überprüfung auf potenzielle Probleme:');

    const [dojoOhneStandort] = await connection.query(`
      SELECT d.dojoname
      FROM dojo d
      LEFT JOIN standorte s ON d.id = s.dojo_id AND s.ist_hauptstandort = TRUE
      WHERE d.ist_aktiv = TRUE AND s.standort_id IS NULL
    `);

    if (dojoOhneStandort.length > 0) {
      console.log('❌ Dojos ohne Hauptstandort:');
      dojoOhneStandort.forEach(d => console.log(`   - ${d.dojoname}`));
    } else {
      console.log('✅ Alle aktiven Dojos haben einen Hauptstandort');
    }

    const [kurseOhneStandort] = await connection.query(`
      SELECT COUNT(*) as anzahl FROM kurse WHERE dojo_id IS NOT NULL AND standort_id IS NULL
    `);

    if (kurseOhneStandort[0].anzahl > 0) {
      console.log(`⚠️  ${kurseOhneStandort[0].anzahl} Kurse haben noch keinen Standort zugeordnet`);
    } else {
      console.log('✅ Alle Kurse haben einen Standort zugeordnet');
    }

    console.log('\n✅ Migration 031 erfolgreich abgeschlossen!\n');
    console.log('📝 Nächste Schritte:');
    console.log('   1. Backend API erstellen: backend/routes/standorte.js');
    console.log('   2. Frontend Context erstellen: frontend/src/context/StandortContext.jsx');
    console.log('   3. UI-Komponenten implementieren');
    console.log('');

  } catch (error) {
    console.error('\n❌ Fehler bei Migration 031:', error.message);
    console.error('\nFehler-Details:');
    console.error(error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Migration ausführen
runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
