const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'dojo',
    multipleStatements: true
  });

  try {
    console.log('🔄 Starte Migration 030: Schema-Anpassung...');

    // 1. Add beigetreten_am column
    try {
      await connection.query(`
        ALTER TABLE mitglieder
        ADD COLUMN beigetreten_am DATE NULL AFTER eintrittsdatum
      `);
      console.log('✅ Spalte beigetreten_am hinzugefügt');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Spalte beigetreten_am existiert bereits');
      } else {
        throw err;
      }
    }

    // 2. Copy data from eintrittsdatum to beigetreten_am
    await connection.query(`
      UPDATE mitglieder
      SET beigetreten_am = eintrittsdatum
      WHERE beigetreten_am IS NULL AND eintrittsdatum IS NOT NULL
    `);
    console.log('✅ Daten von eintrittsdatum nach beigetreten_am kopiert');

    // 3. Add gesamtsumme column
    try {
      await connection.query(`
        ALTER TABLE rechnungen
        ADD COLUMN gesamtsumme DECIMAL(10,2) NULL AFTER betrag
      `);
      console.log('✅ Spalte gesamtsumme hinzugefügt');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Spalte gesamtsumme existiert bereits');
      } else {
        throw err;
      }
    }

    // 4. Copy data from brutto_betrag/betrag to gesamtsumme
    await connection.query(`
      UPDATE rechnungen
      SET gesamtsumme = COALESCE(brutto_betrag, betrag)
      WHERE gesamtsumme IS NULL
    `);
    console.log('✅ Daten nach gesamtsumme kopiert');

    console.log('\n✅ Migration 030 erfolgreich abgeschlossen!');

  } catch (error) {
    console.error('❌ Fehler bei Migration 030:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
