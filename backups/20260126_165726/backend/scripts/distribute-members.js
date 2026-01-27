// Script zum Verteilen der Mitglieder auf verschiedene Dojos
const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojo'
});

async function distributeMembersToDojos() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Starte Mitglieder-Verteilung...\n');

    // 1. Hole alle aktiven Dojos
    db.query('SELECT id, dojoname FROM dojo WHERE ist_aktiv = TRUE ORDER BY id', (err, dojos) => {
      if (err) {
        console.error('❌ Fehler beim Laden der Dojos:', err);
        return reject(err);
      }

      if (dojos.length === 0) {
        console.log('⚠️  Keine aktiven Dojos gefunden!');
        return reject(new Error('Keine Dojos verfügbar'));
      }

      console.log('📋 Gefundene Dojos:');
      dojos.forEach(d => console.log(`   - ID ${d.id}: ${d.dojoname}`));
      console.log('');

      // 2. Prüfe ob dojo_id Spalte existiert
      db.query("SHOW COLUMNS FROM mitglieder LIKE 'dojo_id'", (err2, cols) => {
        if (err2) {
          console.error('❌ Fehler beim Prüfen der Spalte:', err2);
          return reject(err2);
        }

        const addColumnPromise = new Promise((resolveCol, rejectCol) => {
          if (cols.length === 0) {
            console.log('➕ Füge dojo_id Spalte zur mitglieder Tabelle hinzu...');
            db.query(
              'ALTER TABLE mitglieder ADD COLUMN dojo_id INT DEFAULT NULL AFTER id, ADD INDEX idx_dojo_id (dojo_id)',
              (err3) => {
                if (err3) {
                  console.error('❌ Fehler beim Hinzufügen der Spalte:', err3);
                  return rejectCol(err3);
                }
                console.log('✅ dojo_id Spalte hinzugefügt\n');
                resolveCol();
              }
            );
          } else {
            console.log('✅ dojo_id Spalte existiert bereits\n');
            resolveCol();
          }
        });

        addColumnPromise.then(() => {
          // 3. Hole alle Mitglieder
          db.query('SELECT mitglied_id FROM mitglieder ORDER BY mitglied_id', (err4, members) => {
            if (err4) {
              console.error('❌ Fehler beim Laden der Mitglieder:', err4);
              return reject(err4);
            }

            console.log(`👥 Anzahl Mitglieder: ${members.length}`);
            console.log(`🏢 Anzahl Dojos: ${dojos.length}\n`);

            if (members.length === 0) {
              console.log('⚠️  Keine Mitglieder gefunden!');
              return resolve();
            }

            // 4. Verteile Mitglieder auf Dojos (Round-Robin)
            const updates = [];
            members.forEach((member, index) => {
              const dojoIndex = index % dojos.length;
              const dojoId = dojos[dojoIndex].id;
              updates.push({ memberId: member.mitglied_id, dojoId: dojoId });
            });

            // 5. Führe Updates durch
            let completed = 0;
            const total = updates.length;

            console.log('🔄 Verteile Mitglieder...\n');

            updates.forEach(update => {
              db.query(
                'UPDATE mitglieder SET dojo_id = ? WHERE mitglied_id = ?',
                [update.dojoId, update.memberId],
                (err5) => {
                  if (err5) {
                    console.error(`❌ Fehler bei Mitglied ${update.memberId}:`, err5);
                  }

                  completed++;

                  if (completed === total) {
                    // 6. Zeige Statistik
                    console.log('✅ Verteilung abgeschlossen!\n');
                    console.log('📊 Statistik:');

                    dojos.forEach(dojo => {
                      db.query(
                        'SELECT COUNT(*) as count FROM mitglieder WHERE dojo_id = ?',
                        [dojo.id],
                        (err6, result) => {
                          if (!err6) {
                            console.log(`   ${dojo.dojoname}: ${result[0].count} Mitglieder`);
                          }

                          // Wenn letztes Dojo
                          if (dojo.id === dojos[dojos.length - 1].id) {
                            console.log('\n✅ Fertig!');
                            db.end();
                            resolve();
                          }
                        }
                      );
                    });
                  }
                }
              );
            });
          });
        }).catch(reject);
      });
    });
  });
}

// Führe Script aus
distributeMembersToDojos()
  .then(() => {
    console.log('\n🎉 Script erfolgreich beendet!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Script fehlgeschlagen:', err);
    process.exit(1);
  });
