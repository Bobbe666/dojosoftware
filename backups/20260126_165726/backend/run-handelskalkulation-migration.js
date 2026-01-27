const db = require('./db');

console.log('='.repeat(80));
console.log('HANDELSKALKULATION MIGRATION - Vollständige kaufmännische Kalkulation');
console.log('='.repeat(80));

// Array mit einzelnen SQL-Statements
const statements = [
  // Bezugskalkulation
  `ALTER TABLE artikel
   ADD COLUMN listeneinkaufspreis_cent INT DEFAULT 0
   COMMENT 'Listeneinkaufspreis in Cent'`,

  `ALTER TABLE artikel
   ADD COLUMN lieferrabatt_prozent DECIMAL(5,2) DEFAULT 0.00
   COMMENT 'Lieferrabatt in Prozent'`,

  `ALTER TABLE artikel
   ADD COLUMN lieferskonto_prozent DECIMAL(5,2) DEFAULT 0.00
   COMMENT 'Lieferskonto (Zahlungsabzug) in Prozent'`,

  `ALTER TABLE artikel
   ADD COLUMN bezugskosten_cent INT DEFAULT 0
   COMMENT 'Bezugskosten (Versand, Zoll, Verpackung) in Cent'`,

  // Selbstkostenkalkulation
  `ALTER TABLE artikel
   ADD COLUMN gemeinkosten_prozent DECIMAL(5,2) DEFAULT 0.00
   COMMENT 'Gemeinkosten (Miete, Personal, etc.) in Prozent'`,

  `ALTER TABLE artikel
   ADD COLUMN gewinnzuschlag_prozent DECIMAL(5,2) DEFAULT 0.00
   COMMENT 'Gewinnzuschlag in Prozent'`,

  // Verkaufskalkulation
  `ALTER TABLE artikel
   ADD COLUMN kundenskonto_prozent DECIMAL(5,2) DEFAULT 0.00
   COMMENT 'Kundenskonto (Zahlungsabzug für Kunden) in Prozent'`,

  `ALTER TABLE artikel
   ADD COLUMN kundenrabatt_prozent DECIMAL(5,2) DEFAULT 0.00
   COMMENT 'Kundenrabatt in Prozent'`
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
console.log('Starte Handelskalkulation-Migration...\n');
executeStatement(0);
