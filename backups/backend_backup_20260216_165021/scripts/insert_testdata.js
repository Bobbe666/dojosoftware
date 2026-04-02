const db = require('../db');

console.log('🔄 Füge Testdaten für Tom Tester (Mitglied-ID: 3) ein...\n');

const tom_id = 3;

// 1. Hole Dojo-ID
db.query('SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?', [tom_id], (err, results) => {
  if (err) {
    console.error('❌ Fehler beim Abrufen der Mitgliedsdaten:', err);
    process.exit(1);
  }

  if (results.length === 0) {
    console.error('❌ Mitglied mit ID 3 nicht gefunden!');
    process.exit(1);
  }

  const dojo_id = results[0].dojo_id;
  console.log(`✅ Tom Tester gefunden - Dojo-ID: ${dojo_id}\n`);

  // 2. Hole einen Stundenplan für Anwesenheitsdaten
  db.query('SELECT stundenplan_id FROM stundenplan LIMIT 1', [], (err, stundenplanResults) => {
    if (err || stundenplanResults.length === 0) {
      console.error('❌ Kein Stundenplan gefunden! Bitte erst einen Kurs/Stundenplan anlegen.');
      process.exit(1);
    }

    const stundenplan_id = stundenplanResults[0].stundenplan_id;
    console.log(`📅 Verwende Stundenplan-ID: ${stundenplan_id}`);

    // 3. Erstelle Anwesenheitsdaten
    console.log('📊 Erstelle Anwesenheitsdaten...');

    // Tage für die letzten 8 Wochen (Mo, Mi, Fr)
    const days = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30, 32, 35, 37, 39, 42, 44, 46, 49, 51, 53, 56, 58];

    let anwesenheitInserts = 0;
    let anwesenheitPromises = [];

    days.forEach(daysAgo => {
      const datum = new Date();
      datum.setDate(datum.getDate() - daysAgo);
      const datumStr = datum.toISOString().split('T')[0];

      const promise = new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO anwesenheit (mitglied_id, stundenplan_id, datum, anwesend, dojo_id, erstellt_am)
           VALUES (?, ?, ?, 1, ?, NOW())
           ON DUPLICATE KEY UPDATE anwesend = 1`,
          [tom_id, stundenplan_id, datumStr, dojo_id],
          (err, result) => {
            if (err) {
              console.error(`❌ Fehler bei Datum ${datumStr}:`, err.message);
              reject(err);
            } else {
              anwesenheitInserts++;
              resolve();
            }
          }
        );
      });

      anwesenheitPromises.push(promise);
    });

    Promise.all(anwesenheitPromises)
      .then(() => {
        console.log(`✅ ${anwesenheitInserts} Anwesenheitseinträge erstellt\n`);

        // 4. Erstelle Vertrag (falls nicht vorhanden)
      console.log('💰 Prüfe Vertrag...');

        db.query('SELECT COUNT(*) as count FROM vertraege WHERE mitglied_id = ?', [tom_id], (err, results) => {
          if (err) {
            console.error('❌ Fehler beim Prüfen der Verträge:', err);
            process.exit(1);
          }

          const existingVertraege = results[0].count;

          if (existingVertraege > 0) {
            console.log(`✅ Vertrag existiert bereits (${existingVertraege} Vertrag/Verträge vorhanden)\n`);
            showSummary();
          } else {
            // Hole ersten Tarif für dieses Dojo
            db.query('SELECT tarif_id FROM tarife WHERE dojo_id = ? LIMIT 1', [dojo_id], (err, tarifResults) => {
              if (err || tarifResults.length === 0) {
                console.warn('⚠️ Kein Tarif für dieses Dojo gefunden, überspringe Vertragserstellung\n');
                showSummary();
                return;
              }

              const tarif_id = tarifResults[0].tarif_id;
              const startDatum = new Date();
              startDatum.setMonth(startDatum.getMonth() - 6);
              const startDatumStr = startDatum.toISOString().split('T')[0];

              const naechsteZahlung = new Date();
              naechsteZahlung.setMonth(naechsteZahlung.getMonth() + 1);
              const naechsteZahlungStr = naechsteZahlung.toISOString().split('T')[0];

              db.query(
                `INSERT INTO vertraege (
                  mitglied_id, tarif_id, start_datum, status, zahlungsart,
                  monatlicher_betrag, naechste_zahlung, erstellt_am, dojo_id
                ) VALUES (?, ?, ?, 'aktiv', 'lastschrift', 59.90, ?, NOW(), ?)`,
                [tom_id, tarif_id, startDatumStr, naechsteZahlungStr, dojo_id],
                (err, result) => {
                  if (err) {
                    console.error('❌ Fehler beim Erstellen des Vertrags:', err);
                  } else {
                    console.log(`✅ Vertrag erstellt (ID: ${result.insertId})\n`);
                  }
                  showSummary();
                }
              );
            });
          }
        });
      })
      .catch(err => {
        console.error('❌ Fehler beim Erstellen der Anwesenheitsdaten:', err);
        process.exit(1);
      });
  }); // Ende stundenplan query

  // Zusammenfassung anzeigen
  function showSummary() {
    console.log('=== ÜBERSICHT TESTDATEN ===\n');

    db.query(
      `SELECT
        CONCAT(m.vorname, ' ', m.nachname, ' (ID: ', m.mitglied_id, ')') as Mitglied,
        COUNT(a.id) as Anwesenheiten,
        MIN(a.datum) as Von,
        MAX(a.datum) as Bis
      FROM mitglieder m
      LEFT JOIN anwesenheit a ON m.mitglied_id = a.mitglied_id
      WHERE m.mitglied_id = ?
      GROUP BY m.mitglied_id, m.vorname, m.nachname`,
      [tom_id],
      (err, results) => {
        if (err) {
          console.error('❌ Fehler bei Zusammenfassung:', err);
        } else if (results.length > 0) {
          const row = results[0];
          console.log(`👤 Mitglied: ${row.Mitglied}`);
          console.log(`📊 Anwesenheiten: ${row.Anwesenheiten}`);
          console.log(`📅 Zeitraum: ${row.Von} bis ${row.Bis}`);
        }

        db.query(
          `SELECT
            vertrag_id, status, monatlicher_betrag, start_datum, naechste_zahlung
          FROM vertraege
          WHERE mitglied_id = ?`,
          [tom_id],
          (err, vertraegeResults) => {
            if (err) {
              console.error('❌ Fehler bei Verträgen:', err);
            } else if (vertraegeResults.length > 0) {
              console.log('\n💰 Verträge:');
              vertraegeResults.forEach(v => {
                console.log(`   - Vertrag ${v.vertrag_id}: ${v.status}, ${v.monatlicher_betrag}€/Monat`);
                console.log(`     Seit: ${v.start_datum}, Nächste Zahlung: ${v.naechste_zahlung}`);
              });
            }

            console.log('\n✅ TESTDATEN ERFOLGREICH EINGEFÜGT!');
            process.exit(0);
          }
        );
      }
    );
  }
});
