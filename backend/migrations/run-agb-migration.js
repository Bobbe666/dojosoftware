#!/usr/bin/env node
/**
 * Migration: Rechtliche Dokumente Versionierung
 * Fuehrt die add_agb_versioning.sql Migration aus
 *
 * Verwendung:
 *   node run-agb-migration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  AGB/Datenschutz Versionierung Migration       ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  // DB Verbindung
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'dojo',
    multipleStatements: true
  });

  try {
    console.log('✓ Datenbankverbindung hergestellt');

    // Migrations-Statements einzeln ausfuehren (IF NOT EXISTS funktioniert nicht in allen MySQL-Versionen)
    const alterStatements = [
      // DOJO Tabelle - Versionen
      "ALTER TABLE dojo ADD COLUMN agb_version VARCHAR(50) DEFAULT '1.0'",
      "ALTER TABLE dojo ADD COLUMN agb_letzte_aenderung DATETIME DEFAULT NULL",
      "ALTER TABLE dojo ADD COLUMN dsgvo_version VARCHAR(50) DEFAULT '1.0'",
      "ALTER TABLE dojo ADD COLUMN dsgvo_letzte_aenderung DATETIME DEFAULT NULL",
      "ALTER TABLE dojo ADD COLUMN dojo_regeln_version VARCHAR(50) DEFAULT '1.0'",
      "ALTER TABLE dojo ADD COLUMN dojo_regeln_letzte_aenderung DATETIME DEFAULT NULL",
      "ALTER TABLE dojo ADD COLUMN hausordnung_version VARCHAR(50) DEFAULT '1.0'",
      "ALTER TABLE dojo ADD COLUMN hausordnung_letzte_aenderung DATETIME DEFAULT NULL",

      // MITGLIEDER Tabelle - Akzeptanz
      "ALTER TABLE mitglieder ADD COLUMN agb_akzeptiert_version VARCHAR(50) DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN agb_akzeptiert_am DATETIME DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN dsgvo_akzeptiert_version VARCHAR(50) DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN dsgvo_akzeptiert_am DATETIME DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN dojo_regeln_akzeptiert_version VARCHAR(50) DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN dojo_regeln_akzeptiert_am DATETIME DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN hausordnung_akzeptiert_version VARCHAR(50) DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN hausordnung_akzeptiert_am DATETIME DEFAULT NULL",
      "ALTER TABLE mitglieder ADD COLUMN import_bestaetigt BOOLEAN DEFAULT FALSE",
      "ALTER TABLE mitglieder ADD COLUMN import_bestaetigt_am DATETIME DEFAULT NULL"
    ];

    let success = 0;
    let skipped = 0;

    for (const sql of alterStatements) {
      try {
        await connection.execute(sql);
        console.log(`  ✓ ${sql.split(' ')[4]} hinzugefuegt`);
        success++;
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  - ${sql.split(' ')[4]} existiert bereits`);
          skipped++;
        } else {
          console.error(`  ✗ Fehler: ${err.message}`);
        }
      }
    }

    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log(`║  Migration abgeschlossen                       ║`);
    console.log(`║  Neu: ${success}, Uebersprungen: ${skipped}                        ║`);
    console.log('╚════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('Fehler bei Migration:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
