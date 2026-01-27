const db = require('./db');
const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, 'migrations', '012_add_vertrag_basic_fields.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log('🔄 Führe Migration 012 aus...');

// Split SQL by semicolons and execute each statement
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

let completed = 0;

function executeNext(index) {
  if (index >= statements.length) {
    console.log(`✅ Migration 012 erfolgreich abgeschlossen! (${completed} Statements ausgeführt)`);
    process.exit(0);
    return;
  }

  const statement = statements[index];

  db.query(statement, (err, results) => {
    if (err) {
      console.error(`❌ Fehler bei Statement ${index + 1}:`, err.message);
      console.error('Statement:', statement.substring(0, 100));
    } else {
      completed++;
      if (results && results[0] && results[0].Info) {
        console.log(`ℹ️ ${results[0].Info}`);
      } else if (results && results[0] && results[0].Status) {
        console.log(`✅ ${results[0].Status}`);
      }
    }

    executeNext(index + 1);
  });
}

executeNext(0);
