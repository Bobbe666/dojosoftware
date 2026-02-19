/**
 * Migration 051: Performance-Indizes hinzufügen
 *
 * Diese Migration fügt wichtige Indizes hinzu, die bei der Performance-Analyse
 * als fehlend identifiziert wurden.
 *
 * AUSFÜHRUNG:
 * node migrations/051_add_performance_indices.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const indices = [
  // Mitglieder - dojo_id wird in fast allen Queries verwendet
  { table: 'mitglieder', name: 'idx_mitglieder_dojo_id', columns: 'dojo_id' },
  { table: 'mitglieder', name: 'idx_mitglieder_status', columns: 'status' },
  { table: 'mitglieder', name: 'idx_mitglieder_dojo_status', columns: 'dojo_id, status' },

  // Anwesenheit - häufig nach mitglied_id und datum gefiltert
  { table: 'anwesenheit', name: 'idx_anwesenheit_mitglied_id', columns: 'mitglied_id' },
  { table: 'anwesenheit', name: 'idx_anwesenheit_datum', columns: 'datum' },
  { table: 'anwesenheit', name: 'idx_anwesenheit_mitglied_datum', columns: 'mitglied_id, datum' },

  // Checkins - Performance-kritisch für Live-Display
  { table: 'checkins', name: 'idx_checkins_stundenplan_id', columns: 'stundenplan_id' },
  { table: 'checkins', name: 'idx_checkins_checkin_time', columns: 'checkin_time' },
  { table: 'checkins', name: 'idx_checkins_status', columns: 'status' },
  { table: 'checkins', name: 'idx_checkins_combined', columns: 'stundenplan_id, checkin_time, status' },

  // Prüfungen
  { table: 'pruefungen', name: 'idx_pruefungen_dojo_id', columns: 'dojo_id' },
  { table: 'pruefungen', name: 'idx_pruefungen_mitglied_id', columns: 'mitglied_id' },

  // Beiträge
  { table: 'beitraege', name: 'idx_beitraege_dojo_id', columns: 'dojo_id' },
  { table: 'beitraege', name: 'idx_beitraege_mitglied_id', columns: 'mitglied_id' },
  { table: 'beitraege', name: 'idx_beitraege_bezahlt', columns: 'bezahlt' },
  { table: 'beitraege', name: 'idx_beitraege_dojo_bezahlt', columns: 'dojo_id, bezahlt' },

  // Verträge
  { table: 'vertraege', name: 'idx_vertraege_dojo_id', columns: 'dojo_id' },
  { table: 'vertraege', name: 'idx_vertraege_mitglied_id', columns: 'mitglied_id' },
  { table: 'vertraege', name: 'idx_vertraege_status', columns: 'status' },

  // SEPA Mandate
  { table: 'sepa_mandate', name: 'idx_sepa_mandate_mitglied_id', columns: 'mitglied_id' },
  { table: 'sepa_mandate', name: 'idx_sepa_mandate_status', columns: 'status' },

  // Rechnungen
  { table: 'rechnungen', name: 'idx_rechnungen_dojo_id', columns: 'dojo_id' },
  { table: 'rechnungen', name: 'idx_rechnungen_mitglied_id', columns: 'mitglied_id' },
  { table: 'rechnungen', name: 'idx_rechnungen_status', columns: 'status' },

  // Stundenplan
  { table: 'stundenplan', name: 'idx_stundenplan_dojo_id', columns: 'dojo_id' },
  { table: 'stundenplan', name: 'idx_stundenplan_wochentag', columns: 'wochentag' },

  // Ehemalige
  { table: 'ehemalige', name: 'idx_ehemalige_dojo_id', columns: 'dojo_id' },

  // Interessenten
  { table: 'interessenten', name: 'idx_interessenten_dojo_id', columns: 'dojo_id' },
  { table: 'interessenten', name: 'idx_interessenten_status', columns: 'status' },
];

async function run() {
  console.log('🚀 Migration 051: Performance-Indizes hinzufügen\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'dojosoftware'
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const idx of indices) {
    try {
      // Prüfe ob Index bereits existiert
      const [existing] = await connection.query(`
        SELECT COUNT(*) as count
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      `, [idx.table, idx.name]);

      if (existing[0].count > 0) {
        console.log(`⏭️  Index ${idx.name} existiert bereits`);
        skipped++;
        continue;
      }

      // Prüfe ob Tabelle existiert
      const [tables] = await connection.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = ?
      `, [idx.table]);

      if (tables[0].count === 0) {
        console.log(`⚠️  Tabelle ${idx.table} existiert nicht, überspringe ${idx.name}`);
        skipped++;
        continue;
      }

      // Erstelle Index
      await connection.query(`CREATE INDEX ${idx.name} ON ${idx.table}(${idx.columns})`);
      console.log(`✅ Index ${idx.name} auf ${idx.table}(${idx.columns}) erstellt`);
      created++;

    } catch (error) {
      console.log(`❌ Fehler bei ${idx.name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Zusammenfassung:`);
  console.log(`   ✅ Erstellt: ${created}`);
  console.log(`   ⏭️  Übersprungen: ${skipped}`);
  console.log(`   ❌ Fehlgeschlagen: ${failed}`);

  await connection.end();
  console.log('\n✅ Migration abgeschlossen!');
}

run().catch(console.error);
