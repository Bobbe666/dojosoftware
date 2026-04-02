/**
 * Test-Skript: SEPA-Mandate für Lastschrift-Mitglieder generieren
 *
 * Dieses Skript erstellt automatisch SEPA-Mandate für alle Mitglieder,
 * die Verträge mit Zahlungsmethode "Lastschrift" haben, aber noch
 * kein aktives SEPA-Mandat besitzen.
 */

const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojosoftware'
};

console.log('🚀 SEPA-Mandate Generator für Testdaten');
console.log('📊 Database:', dbConfig.database);
console.log('');

const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('❌ Datenbankverbindung fehlgeschlagen:', err.message);
    process.exit(1);
  }

  console.log('✅ Mit Datenbank verbunden');
  generateMandates();
});

function generateMandates() {
  // Finde alle Mitglieder mit Lastschrift-Verträgen ohne aktives SEPA-Mandat
  const query = `
    SELECT DISTINCT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      COUNT(v.id) as anzahl_vertraege
    FROM mitglieder m
    JOIN vertraege v ON m.mitglied_id = v.mitglied_id
    LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
    WHERE v.status = 'aktiv'
      AND m.zahlungsmethode = 'Lastschrift'
      AND sm.mandat_id IS NULL
    GROUP BY m.mitglied_id
    ORDER BY m.nachname, m.vorname
  `;

  connection.query(query, (err, members) => {
    if (err) {
      console.error('❌ Fehler beim Abrufen der Mitglieder:', err.message);
      connection.end();
      process.exit(1);
    }

    if (members.length === 0) {
      console.log('ℹ️  Keine Mitglieder gefunden, die ein SEPA-Mandat benötigen');
      console.log('   Alle Lastschrift-Mitglieder haben bereits ein aktives Mandat.');
      connection.end();
      process.exit(0);
    }

    console.log(`\n📋 Gefunden: ${members.length} Mitglieder ohne SEPA-Mandat:\n`);
    members.forEach((m, idx) => {
      console.log(`   ${idx + 1}. ${m.vorname} ${m.nachname} (ID: ${m.mitglied_id}) - ${m.anzahl_vertraege} Vertrag/Verträge`);
    });

    console.log('\n🔄 Erstelle SEPA-Mandate...\n');

    // Erstelle Mandate für alle gefundenen Mitglieder
    let processed = 0;
    let errors = 0;

    members.forEach((member, index) => {
      // Generiere Test-IBAN (deutsche IBAN-Format)
      const randomAccountNumber = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
      const testIBAN = `DE${String(89 - (index % 20)).padStart(2, '0')}${randomAccountNumber}${String(index).padStart(10, '0')}`;

      // Deutsche Test-BICs
      const testBICs = [
        'COBADEFFXXX', // Commerzbank
        'DEUTDEFFXXX', // Deutsche Bank
        'BYLADEM1XXX', // Sparkasse
        'GENODEF1XXX', // Volksbank
        'PBNKDEFFXXX', // Postbank
        'DRESDEFF760'  // Commerzbank Filiale
      ];
      const testBIC = testBICs[index % testBICs.length];

      const testBanks = [
        'Commerzbank',
        'Deutsche Bank',
        'Sparkasse',
        'Volksbank',
        'Postbank',
        'HypoVereinsbank'
      ];
      const bankName = testBanks[index % testBanks.length];

      const kontoinhaber = `${member.vorname} ${member.nachname}`;
      const mandatsreferenz = `DOJO-${member.mitglied_id}-${Date.now() + index}`;
      const glaeubiger_id = 'DE98ZZZ09999999999'; // Standard Test Gläubiger-ID

      const insertQuery = `
        INSERT INTO sepa_mandate (
          mitglied_id,
          iban,
          bic,
          bankname,
          kontoinhaber,
          mandatsreferenz,
          glaeubiger_id,
          status,
          mandat_typ,
          sequenz,
          erstellungsdatum,
          provider
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'aktiv', 'CORE', 'RCUR', NOW(), 'manual_sepa')
      `;

      const params = [
        member.mitglied_id,
        testIBAN,
        testBIC,
        bankName,
        kontoinhaber,
        mandatsreferenz,
        glaeubiger_id
      ];

      connection.query(insertQuery, params, (err, result) => {
        processed++;

        if (err) {
          errors++;
          console.log(`   ❌ ${member.vorname} ${member.nachname}: Fehler - ${err.message}`);
        } else {
          console.log(`   ✅ ${member.vorname} ${member.nachname}: SEPA-Mandat erstellt (${mandatsreferenz})`);
          console.log(`      IBAN: ${testIBAN} | BIC: ${testBIC} | Bank: ${bankName}`);
        }

        // Wenn alle verarbeitet wurden
        if (processed === members.length) {
          console.log('\n' + '='.repeat(70));
          console.log(`✅ Fertig! ${processed - errors} von ${members.length} SEPA-Mandaten erfolgreich erstellt`);
          if (errors > 0) {
            console.log(`⚠️  ${errors} Fehler aufgetreten`);
          }
          console.log('='.repeat(70) + '\n');

          // Zeige Statistik
          showStatistics();
        }
      });
    });
  });
}

function showStatistics() {
  const statsQuery = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'aktiv' THEN 1 ELSE 0 END) as aktiv,
      SUM(CASE WHEN status = 'widerrufen' THEN 1 ELSE 0 END) as widerrufen,
      SUM(CASE WHEN status = 'abgelaufen' THEN 1 ELSE 0 END) as abgelaufen
    FROM sepa_mandate
    WHERE archiviert = 0 OR archiviert IS NULL
  `;

  connection.query(statsQuery, (err, stats) => {
    if (!err && stats.length > 0) {
      const s = stats[0];
      console.log('📊 Aktuelle SEPA-Mandate Statistik:');
      console.log(`   Gesamt: ${s.total}`);
      console.log(`   Aktiv: ${s.aktiv}`);
      console.log(`   Widerrufen: ${s.widerrufen}`);
      console.log(`   Abgelaufen: ${s.abgelaufen}`);
    }

    connection.end();
    console.log('\n🎉 Skript erfolgreich beendet!\n');
  });
}
