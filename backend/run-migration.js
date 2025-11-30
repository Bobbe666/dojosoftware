const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Datenbank-Verbindung erstellen
const connection = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "dojoUser",
  password: process.env.DB_PASSWORD || "DojoServer2025!",
  database: process.env.DB_NAME || "dojo",
  multipleStatements: true
});

console.log('🔧 Starte Datenbank-Migration: add_vertragsfrei.sql');
console.log(`📊 Datenbank: ${process.env.DB_NAME || "dojo"}`);
console.log(`🖥️  Host: ${process.env.DB_HOST || "localhost"}`);

// Migration-Datei lesen
const migrationPath = path.join(__dirname, 'migrations', 'add_vertragsfrei.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

// Verbindung herstellen
connection.connect((err) => {
  if (err) {
    console.error('❌ Fehler beim Verbinden zur Datenbank:', err.message);
    process.exit(1);
  }

  console.log('✅ Verbunden mit der Datenbank');

  // Migration ausführen
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Fehler beim Ausführen der Migration:', err.message);
      connection.end();
      process.exit(1);
    }

    console.log('✅ Migration erfolgreich ausgeführt!');
    console.log('📋 Ergebnisse:', results);

    // Prüfe ob die Spalten hinzugefügt wurden
    connection.query('DESCRIBE mitglieder', (err, columns) => {
      if (err) {
        console.error('❌ Fehler beim Prüfen der Spalten:', err.message);
      } else {
        const vertragsfreiCol = columns.find(col => col.Field === 'vertragsfrei');
        const vertragsfreiGrundCol = columns.find(col => col.Field === 'vertragsfrei_grund');

        if (vertragsfreiCol && vertragsfreiGrundCol) {
          console.log('✅ Spalte "vertragsfrei" gefunden:', vertragsfreiCol);
          console.log('✅ Spalte "vertragsfrei_grund" gefunden:', vertragsfreiGrundCol);
          console.log('');
          console.log('🎉 Migration vollständig abgeschlossen!');
          console.log('💡 Die Vertragsfrei-Funktion ist jetzt in Produktion verfügbar.');
        } else {
          console.log('⚠️ Spalten wurden möglicherweise nicht hinzugefügt. Bitte manuell prüfen.');
        }
      }

      connection.end();
      process.exit(0);
    });
  });
});
