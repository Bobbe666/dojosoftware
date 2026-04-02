const db = require('./db');

console.log('='.repeat(80));
console.log('PREISKALKULATION MIGRATION - DIREKT');
console.log('='.repeat(80));

// Array mit einzelnen SQL-Statements
const statements = [
  // Zusatzkosten-Feld hinzufügen
  `ALTER TABLE artikel
   ADD COLUMN zusatzkosten_cent INT DEFAULT 0
   COMMENT 'Zusätzliche Kosten in Cent'`,

  // Marge-Prozent-Feld hinzufügen
  `ALTER TABLE artikel
   ADD COLUMN marge_prozent DECIMAL(5,2) DEFAULT NULL
   COMMENT 'Gewinnaufschlag in Prozent'`
];

let completed = 0;
let errors = 0;

function executeStatement(index) {
  if (index >= statements.length) {
    console.log('='.repeat(80));
    console.log(`Migration abgeschlossen: ${completed} erfolgreich, ${errors} Fehler`);
    console.log('='.repeat(80));
    db.end();
    process.exit(errors > 0 ? 1 : 0);
    return;
  }

  const statement = statements[index];

  console.log(`\nFühre Statement ${index + 1}/${statements.length} aus...`);

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
      completed++;
    }

    // Nächstes Statement
    executeStatement(index + 1);
  });
}

// Migration starten
console.log('Starte Preiskalkulation-Migration...\n');
executeStatement(0);
