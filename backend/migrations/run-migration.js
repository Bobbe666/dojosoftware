// Migrations-Runner für SQL-Dateien
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojo',
  multipleStatements: true // Wichtig für SQL-Dateien mit mehreren Statements
});

async function runMigration(filename) {
  console.log(`\n🚀 Führe Migration aus: ${filename}\n`);

  const sqlPath = path.join(__dirname, filename);

  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Datei nicht gefunden: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  return new Promise((resolve, reject) => {
    db.query(sql, (err, results) => {
      if (err) {
        console.error(`❌ Fehler bei Migration ${filename}:`, err.message);
        reject(err);
      } else {
        console.log(`✅ Migration ${filename} erfolgreich ausgeführt!`);
        if (Array.isArray(results)) {
          results.forEach((result, i) => {
            if (result.affectedRows !== undefined) {
              console.log(`   Statement ${i + 1}: ${result.affectedRows} Zeilen betroffen`);
            }
          });
        }
        resolve(results);
      }
    });
  });
}

// Migrations-Datei aus Kommandozeilen-Argument
const migrationFile = process.argv[2] || '011_erweitere_vertraege_rechtssicher.sql';

runMigration(migrationFile)
  .then(() => {
    console.log('\n✅ Migration abgeschlossen!\n');
    db.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Migration fehlgeschlagen:', err);
    db.end();
    process.exit(1);
  });
