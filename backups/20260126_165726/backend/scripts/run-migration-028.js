const db = require('../db');
const fs = require('fs');
const path = require('path');

const migrationFile = path.join(__dirname, '../migrations/028_fix_rechnungen_cascade_delete.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

console.log('🔧 Führe Migration 028 aus: Fix CASCADE DELETE für Rechnungen\n');

// Splitten nach Semikolon, leere und Kommentar-Zeilen filtern
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

let completed = 0;
let hasError = false;

statements.forEach((stmt, index) => {
  db.query(stmt, (err, result) => {
    if (err) {
      console.error(`❌ Fehler bei Statement ${index + 1}:`, err.message);
      hasError = true;
      if (completed + 1 === statements.length || hasError) {
        process.exit(1);
      }
    } else {
      console.log(`✅ Statement ${index + 1} erfolgreich ausgeführt`);
      completed++;

      if (completed === statements.length) {
        console.log('\n✅ Migration 028 erfolgreich abgeschlossen!');
        console.log('   Foreign Key Constraint geändert: CASCADE → RESTRICT');
        console.log('   Mitglieder mit Rechnungen können nun nicht mehr gelöscht werden.');
        process.exit(0);
      }
    }
  });
});
