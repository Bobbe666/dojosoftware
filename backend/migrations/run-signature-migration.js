#!/usr/bin/env node
/**
 * Migration: Digitale Unterschrift fuer SEPA-Mandate
 * Fuegt unterschrift_digital, unterschrift_datum, unterschrift_ip, unterschrift_hash hinzu
 *
 * Verwendung:
 *   node run-signature-migration.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  SEPA-Mandat Unterschrift Migration            ║');
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

    // Migrations-Statements einzeln ausfuehren
    const alterStatements = [
      "ALTER TABLE sepa_mandate ADD COLUMN unterschrift_digital LONGTEXT COMMENT 'Base64-kodierte digitale Unterschrift des Mandats'",
      "ALTER TABLE sepa_mandate ADD COLUMN unterschrift_datum DATETIME COMMENT 'Zeitstempel der digitalen Unterschrift'",
      "ALTER TABLE sepa_mandate ADD COLUMN unterschrift_ip VARCHAR(45) COMMENT 'IP-Adresse bei der digitalen Unterschrift'",
      "ALTER TABLE sepa_mandate ADD COLUMN unterschrift_hash VARCHAR(64) COMMENT 'SHA-256 Hash der Unterschrift zur Integritaetspruefung'"
    ];

    let success = 0;
    let skipped = 0;

    for (const sql of alterStatements) {
      try {
        await connection.execute(sql);
        const columnName = sql.match(/ADD COLUMN (\w+)/)?.[1] || 'unknown';
        console.log(`  ✓ ${columnName} hinzugefuegt`);
        success++;
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          const columnName = sql.match(/ADD COLUMN (\w+)/)?.[1] || 'unknown';
          console.log(`  - ${columnName} existiert bereits`);
          skipped++;
        } else {
          console.error(`  ✗ Fehler: ${err.message}`);
        }
      }
    }

    // Index erstellen (falls nicht vorhanden)
    try {
      await connection.execute('CREATE INDEX idx_sepa_mandate_unterschrift ON sepa_mandate (unterschrift_datum)');
      console.log('  ✓ Index idx_sepa_mandate_unterschrift erstellt');
      success++;
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('  - Index existiert bereits');
        skipped++;
      } else {
        console.log(`  - Index konnte nicht erstellt werden: ${err.message}`);
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
