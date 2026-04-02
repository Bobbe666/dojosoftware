// Migration 029: Trial & Subscription Management ausführen
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'dojoUser',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'dojo',
  multipleStatements: true
};

async function runMigration() {
  let connection;

  try {
    console.log('🔄 Verbinde mit Datenbank...');
    connection = await mysql.createConnection(config);

    console.log('📖 Lese Migration 029...');
    const migrationPath = path.join(__dirname, '..', 'migrations', '029_add_trial_subscription_fields.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('⚡ Führe Migration aus...');
    await connection.query(sql);

    console.log('✅ Migration 029 erfolgreich ausgeführt!');
    console.log('');
    console.log('Neue Felder:');
    console.log('- trial_ends_at: Ablaufdatum der Testphase (14 Tage)');
    console.log('- subscription_status: trial, active, expired, cancelled, suspended');
    console.log('- subscription_plan: basic, premium, enterprise');
    console.log('- subscription_started_at: Wann wurde das Abo gestartet');
    console.log('- subscription_ends_at: Wann endet das Abo');
    console.log('- last_payment_at: Letzte Zahlung');
    console.log('- payment_interval: monthly, quarterly, yearly');

  } catch (error) {
    console.error('❌ Fehler bei Migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
