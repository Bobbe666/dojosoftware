const db = require('../db');
const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, 'create_mahnungen_table.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log('📦 Starte Mahnungen-Tabellen Migration...');

db.query(sql, (err, results) => {
  if (err) {
    console.error('❌ Fehler bei der Migration:', err);
    process.exit(1);
  }

  console.log('✅ Mahnungen-Tabelle erfolgreich erstellt!');
  console.log('📊 Migration abgeschlossen.');
  process.exit(0);
});
