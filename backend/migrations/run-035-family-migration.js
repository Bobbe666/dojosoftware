// Migration 035 Runner: Familien-Registrierung Felder
// Führt einzelne ALTER TABLE Statements aus und ignoriert "Column already exists" Fehler

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  console.log('\n🚀 Starte Migration 035: Familien-Registrierung Felder\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dojo',
    multipleStatements: true
  });

  const statements = [
    // 1. Spalten zu mitglieder hinzufügen
    {
      name: 'mitglieder.ist_hauptmitglied',
      sql: `ALTER TABLE mitglieder ADD COLUMN ist_hauptmitglied BOOLEAN DEFAULT FALSE`
    },
    {
      name: 'mitglieder.familie_position',
      sql: `ALTER TABLE mitglieder ADD COLUMN familie_position INT DEFAULT NULL`
    },

    // 2. Spalten zu rabatte hinzufügen
    {
      name: 'rabatte.ist_familien_rabatt',
      sql: `ALTER TABLE rabatte ADD COLUMN ist_familien_rabatt BOOLEAN DEFAULT FALSE`
    },
    {
      name: 'rabatte.familie_position_min',
      sql: `ALTER TABLE rabatte ADD COLUMN familie_position_min INT DEFAULT NULL`
    },
    {
      name: 'rabatte.familie_position_max',
      sql: `ALTER TABLE rabatte ADD COLUMN familie_position_max INT DEFAULT NULL`
    },

    // 3. Junction-Tabelle mitglied_rabatte erstellen
    {
      name: 'mitglied_rabatte Tabelle',
      sql: `CREATE TABLE IF NOT EXISTS mitglied_rabatte (
        id INT NOT NULL AUTO_INCREMENT,
        mitglied_id INT NOT NULL,
        rabatt_id INT NOT NULL,
        angewendet_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        entfernt_am TIMESTAMP NULL DEFAULT NULL,
        entfernt_grund VARCHAR(255) DEFAULT NULL,
        aktiv BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (id),
        KEY idx_mitglied_id (mitglied_id),
        KEY idx_rabatt_id (rabatt_id),
        KEY idx_aktiv (aktiv),
        CONSTRAINT fk_mitglied_rabatte_mitglied FOREIGN KEY (mitglied_id)
          REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
        CONSTRAINT fk_mitglied_rabatte_rabatt FOREIGN KEY (rabatt_id)
          REFERENCES rabatte(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    }
  ];

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const stmt of statements) {
    try {
      await connection.query(stmt.sql);
      console.log(`✅ ${stmt.name} - Erfolgreich`);
      successCount++;
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        // Spalte existiert bereits
        console.log(`⏭️  ${stmt.name} - Übersprungen (existiert bereits)`);
        skipCount++;
      } else if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.errno === 1050) {
        // Tabelle existiert bereits
        console.log(`⏭️  ${stmt.name} - Übersprungen (existiert bereits)`);
        skipCount++;
      } else {
        console.error(`❌ ${stmt.name} - Fehler:`, err.message);
        errorCount++;
      }
    }
  }

  await connection.end();

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Erfolgreich: ${successCount}`);
  console.log(`⏭️  Übersprungen: ${skipCount}`);
  console.log(`❌ Fehler: ${errorCount}`);
  console.log('='.repeat(50) + '\n');

  if (errorCount > 0) {
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('💥 Migration fehlgeschlagen:', err);
  process.exit(1);
});
