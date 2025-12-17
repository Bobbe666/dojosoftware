const fs = require('fs');
const path = require('path');
const db = require('../db');

console.log('='.repeat(80));
console.log('PREISKALKULATION MIGRATION');
console.log('='.repeat(80));

// SQL-Datei einlesen
const sqlFile = path.join(__dirname, 'add_preiskalkulation_felder.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// SQL in einzelne Statements aufteilen
const statements = sql
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

// Statements nacheinander ausführen
let completed = 0;
let errors = 0;

function executeStatement(index) {
  if (index >= statements.length) {
    console.log('='.repeat(80));
    console.log(`Migration abgeschlossen: ${completed} erfolgreich, ${errors} Fehler`);
    console.log('='.repeat(80));
    process.exit(errors > 0 ? 1 : 0);
    return;
  }

  const statement = statements[index];

  // Kommentare überspringen
  if (statement.startsWith('--') || statement.startsWith('/*')) {
    executeStatement(index + 1);
    return;
  }

  console.log(`Führe Statement ${index + 1}/${statements.length} aus...`);

  db.query(statement, (error, results) => {
    if (error) {
      // Ignoriere "duplicate column" Fehler (Feld existiert bereits)
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️  Feld existiert bereits (wird übersprungen)`);
        completed++;
      } else {
        console.error(`❌ Fehler:`, error.message);
        errors++;
      }
    } else {
      console.log(`✅ Erfolgreich`);
      if (results && results[0] && results[0].Status) {
        console.log(`   ${results[0].Status}`);
      }
      completed++;
    }

    // Nächstes Statement
    executeStatement(index + 1);
  });
}

// Migration starten
console.log('Starte Preiskalkulation-Migration...\n');
executeStatement(0);
