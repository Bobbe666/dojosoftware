const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dojoUser',
    password: process.env.DB_PASSWORD || 'DojoServer2025!',
    database: process.env.DB_NAME || 'dojosoftware',
    multipleStatements: true
  });

  console.log('🚀 Führe Migration für mitglied_dokumente aus...\n');

  try {
    // Read SQL file
    const sqlFilePath = path.join(__dirname, '..', 'migrations', 'create_mitglied_dokumente_table.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📄 SQL-Datei gelesen:', sqlFilePath);

    // Execute migration
    await connection.query(sql);

    console.log('✅ Migration erfolgreich ausgeführt!');

    // Verify table was created
    const [tables] = await connection.query("SHOW TABLES LIKE 'mitglied_dokumente'");
    if (tables.length > 0) {
      console.log('✅ Tabelle mitglied_dokumente wurde erstellt');

      // Show table structure
      const [columns] = await connection.query('DESCRIBE mitglied_dokumente');
      console.log('\n📋 Tabellenstruktur:');
      columns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    }

  } catch (error) {
    console.error('❌ Fehler bei Migration:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Migration abgeschlossen');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Migration fehlgeschlagen:', err);
    process.exit(1);
  });
