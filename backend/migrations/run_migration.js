#!/usr/bin/env node
/**
 * Migration Runner für Performance-Indizes
 * Führt add_performance_indexes.sql aus
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('🚀 Starte Index-Migration...\n');

// Datenbankverbindung
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
});

// SQL-Datei einlesen
const sqlFile = path.join(__dirname, 'add_performance_indexes.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log('📄 SQL-Datei geladen:', sqlFile);
console.log('🔗 Verbinde zur Datenbank...\n');

connection.connect((err) => {
  if (err) {
    console.error('❌ Verbindungsfehler:', err.message);
    process.exit(1);
  }

  console.log('✅ Verbunden!\n');
  console.log('⚠️  WICHTIG: Stelle sicher, dass ein Backup existiert!');
  console.log('💾 Backup-Befehl: mysqldump -u ' + process.env.DB_USER + ' -p ' + process.env.DB_NAME + ' > backup.sql\n');

  // Warte 3 Sekunden
  console.log('⏳ Starte in 3 Sekunden...\n');

  setTimeout(() => {
    console.log('🏗️  Erstelle Indizes...\n');

    connection.query(sql, (error, results) => {
      if (error) {
        console.error('❌ Fehler beim Erstellen der Indizes:', error.message);
        connection.end();
        process.exit(1);
      }

      console.log('✅ Migration erfolgreich!');
      console.log('📊 Ergebnisse:', results.length, 'Statements ausgeführt\n');

      // Index-Statistiken abrufen
      const statsQuery = `
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          NON_UNIQUE,
          COLUMN_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
          AND TABLE_NAME IN ('mitglieder', 'vertraege', 'transaktionen', 'pruefungen', 'anwesenheit', 'notifications', 'admins')
        ORDER BY TABLE_NAME, INDEX_NAME
      `;

      connection.query(statsQuery, (err, stats) => {
        if (!err) {
          console.log('📈 Vorhandene Indizes:\n');
          stats.forEach(row => {
            console.log(`   ${row.TABLE_NAME}.${row.INDEX_NAME} (${row.COLUMN_NAME})`);
          });
        }

        console.log('\n✨ Fertig! Die Datenbank sollte jetzt deutlich schneller sein.\n');
        connection.end();
      });
    });
  }, 3000);
});
