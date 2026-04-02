// ============================================
// AUTOMATISCHER MIGRATIONS-RUNNER
// ============================================
// Führt alle noch nicht ausgeführten Migrationen aus
// Verwendung: node run-all-migrations.js

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runAllMigrations() {
  console.log('🚀 Starte automatische Migrationen...\n');

  // Datenbankverbindung
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dojo',
    multipleStatements: true
  });

  try {
    // Erstelle migrations-Tabelle falls nicht vorhanden
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_migration_name (migration_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Migrations-Tabelle bereit\n');

    // Hole alle bereits ausgeführten Migrationen
    const [executed] = await connection.query('SELECT migration_name FROM migrations');
    const executedNames = new Set(executed.map(r => r.migration_name));
    console.log(`📋 Bereits ausgeführte Migrationen: ${executedNames.size}\n`);

    // Lade alle Migrations-Dateien
    const migrationsDir = __dirname;
    const allFiles = fs.readdirSync(migrationsDir);
    
    // Filtere nur SQL-Dateien mit Nummerierung (z.B. 001_*.sql, 024_*.sql)
    const migrationFiles = allFiles
      .filter(f => f.endsWith('.sql') && /^\d{3}_/.test(f))
      .sort(); // Sortiere alphabetisch (001, 002, 003...)

    console.log(`📁 Gefundene Migrations-Dateien: ${migrationFiles.length}\n`);

    if (migrationFiles.length === 0) {
      console.log('⚠️  Keine Migrations-Dateien gefunden!');
      return;
    }

    let executedCount = 0;
    let skippedCount = 0;

    // Führe jede Migration aus
    for (const file of migrationFiles) {
      if (executedNames.has(file)) {
        console.log(`⏭️  ${file} - bereits ausgeführt`);
        skippedCount++;
        continue;
      }

      console.log(`\n🔄 Führe Migration aus: ${file}`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      // Überspringe leere Dateien
      if (!sql.trim()) {
        console.log(`⚠️  ${file} - Datei ist leer, überspringe`);
        continue;
      }

      try {
        // Führe SQL aus
        await connection.query(sql);
        
        // Trage Migration als ausgeführt ein
        await connection.query(
          'INSERT INTO migrations (migration_name) VALUES (?)',
          [file]
        );
        
        console.log(`✅ ${file} - erfolgreich ausgeführt`);
        executedCount++;
      } catch (error) {
        console.error(`\n❌ ${file} - FEHLER:`);
        console.error(`   ${error.message}`);
        
        // Bei kritischen Fehlern abbrechen
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.code === 'ER_DUP_FIELDNAME') {
          console.log(`   ⚠️  Warnung: ${error.code} - möglicherweise bereits vorhanden`);
          console.log(`   ℹ️  Migration wird trotzdem als ausgeführt markiert`);
          
          // Markiere als ausgeführt, auch wenn Fehler (weil bereits vorhanden)
          try {
            await connection.query(
              'INSERT IGNORE INTO migrations (migration_name) VALUES (?)',
              [file]
            );
            executedCount++;
          } catch (insertError) {
            // Ignoriere Insert-Fehler
          }
        } else {
          console.error(`\n💥 Migration abgebrochen aufgrund von Fehler!`);
          throw error;
        }
      }
    }

    // Zusammenfassung
    console.log('\n' + '='.repeat(50));
    console.log('📊 ZUSAMMENFASSUNG:');
    console.log(`   ✅ Ausgeführt: ${executedCount}`);
    console.log(`   ⏭️  Übersprungen: ${skippedCount}`);
    console.log(`   📁 Gesamt: ${migrationFiles.length}`);
    console.log('='.repeat(50) + '\n');

    if (executedCount > 0) {
      console.log('✅ Alle neuen Migrationen erfolgreich ausgeführt!\n');
    } else {
      console.log('ℹ️  Keine neuen Migrationen gefunden.\n');
    }

  } catch (error) {
    console.error('\n💥 KRITISCHER FEHLER:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Script ausführen
runAllMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration fehlgeschlagen!');
    process.exit(1);
  });


