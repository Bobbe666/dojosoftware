const db = require('../db');
const fs = require('fs');
const path = require('path');

console.log('🔄 Starte Prüfungen-Tabellen Migration...');

// SQL-File einlesen
const sqlFile = path.join(__dirname, 'create_pruefungen_modernized.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

// SQL in einzelne Statements aufteilen (trennen an Semikolon außerhalb von Strings/Comments)
const statements = sqlContent
  .split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/) // Split bei ; aber nicht in Strings
  .map(stmt => stmt.trim())
  .filter(stmt =>
    stmt.length > 0 &&
    !stmt.startsWith('--') &&
    !stmt.startsWith('/*') &&
    stmt.toUpperCase() !== 'USE DOJO'
  );

console.log(`📊 Gefunden: ${statements.length} SQL-Statements`);

// Funktion zum Ausführen eines einzelnen Statements
function executeStatement(statement, callback) {
  // Überspringe USE DATABASE statements
  if (statement.toUpperCase().startsWith('USE ')) {
    return callback(null);
  }

  db.query(statement, (err, result) => {
    if (err) {
      // Manche Fehler sind OK (z.B. "View already exists")
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.message.includes('already exists')) {
        console.log('⚠️  Warnung:', err.message.substring(0, 100) + '...');
        return callback(null);
      }
      return callback(err);
    }

    // Bei SELECT-Statements Ergebnis ausgeben
    if (statement.toUpperCase().startsWith('SELECT')) {
      console.log('✅', result[0]?.Status || 'Query erfolgreich');
    }

    callback(null);
  });
}

// Alle Statements nacheinander ausführen
let currentIndex = 0;

function executeNext() {
  if (currentIndex >= statements.length) {
    console.log('\n✅ Migration erfolgreich abgeschlossen!');
    console.log('\n📋 Erstellte Tabellen:');
    console.log('   - pruefungen (Prüfungshauptdaten)');
    console.log('   - pruefung_teilnehmer (Teilnehmer bei Gruppenprüfungen)');
    console.log('   - pruefung_anforderungen (Prüfungsanforderungen pro Graduierung)');
    console.log('\n📊 Erstellte Views:');
    console.log('   - v_pruefungshistorie (Vollständige Prüfungshistorie)');
    console.log('   - v_anstehende_pruefungen (Kommende Prüfungen)');
    console.log('');
    process.exit(0);
  }

  const statement = statements[currentIndex];
  const shortStatement = statement.substring(0, 60).replace(/\s+/g, ' ');

  console.log(`[${currentIndex + 1}/${statements.length}] ${shortStatement}...`);

  executeStatement(statement, (err) => {
    if (err) {
      console.error('\n❌ Fehler bei Statement', currentIndex + 1);
      console.error('Statement:', statement.substring(0, 200));
      console.error('Fehler:', err.message);
      process.exit(1);
    }

    currentIndex++;
    executeNext();
  });
}

// Migration starten
executeNext();
