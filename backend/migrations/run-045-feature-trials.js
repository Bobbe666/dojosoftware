/**
 * Migration Runner: Feature Trials & Addons
 *
 * Führt die Migration 045 aus um die Tabellen für
 * Feature-Trials und Feature-Addons zu erstellen.
 *
 * Usage: node migrations/run-045-feature-trials.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  console.log('🚀 Starting Migration 045: Feature Trials & Addons...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dojosoftware',
    multipleStatements: true
  });

  try {
    // SQL-Datei lesen
    const sqlPath = path.join(__dirname, '045_create_feature_trials_addons.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Migration SQL gelesen');
    console.log('📊 Führe Migration aus...\n');

    // Migration ausführen
    await connection.query(sql);

    console.log('✅ Migration erfolgreich!\n');

    // Verifizieren
    const [tables] = await connection.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('feature_trials', 'feature_addons', 'feature_addon_prices', 'feature_access_log')
    `);

    console.log('📋 Erstellte Tabellen:');
    tables.forEach(t => console.log(`   - ${t.TABLE_NAME}`));

    // Addon-Preise Count
    const [priceCount] = await connection.query('SELECT COUNT(*) as count FROM feature_addon_prices');
    console.log(`\n💰 ${priceCount[0].count} Feature-Addon-Preise initialisiert`);

  } catch (error) {
    console.error('❌ Migration fehlgeschlagen:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }

  console.log('\n🎉 Migration 045 abgeschlossen!');
}

runMigration();
