const db = require('../db');

async function checkTableStructure() {
  try {
    console.log('🔍 Prüfe Tabellenstruktur...');

    // Prüfe beitraege Tabelle
    const beitraegeStructure = await new Promise((resolve, reject) => {
      db.query('DESCRIBE beitraege', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('📋 beitraege Tabelle Struktur:');
    beitraegeStructure.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Prüfe verkaeufe Tabelle
    const verkaeufeStructure = await new Promise((resolve, reject) => {
      db.query('DESCRIBE verkaeufe', (err, results) => {
        if (err) {
          console.log('❌ verkaeufe Tabelle existiert nicht');
          resolve([]);
        } else {
          resolve(results);
        }
      });
    });

    if (verkaeufeStructure.length > 0) {
      console.log('📋 verkaeufe Tabelle Struktur:');
      verkaeufeStructure.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // Prüfe kassenbuch Tabelle
    const kassenbuchStructure = await new Promise((resolve, reject) => {
      db.query('DESCRIBE kassenbuch', (err, results) => {
        if (err) {
          console.log('❌ kassenbuch Tabelle existiert nicht');
          resolve([]);
        } else {
          resolve(results);
        }
      });
    });

    if (kassenbuchStructure.length > 0) {
      console.log('📋 kassenbuch Tabelle Struktur:');
      kassenbuchStructure.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ Fehler beim Prüfen der Tabellenstruktur:', error);
  }
}

// Script ausführen
checkTableStructure();















