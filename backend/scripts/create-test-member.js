const bcrypt = require('bcryptjs');
const db = require('../db');

const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

const createTestMember = async () => {
  console.log('🔄 Erstelle Test-Benutzer (Mitglied)...\n');

  try {
    // 1. Lösche existierenden Test-User
    console.log('🗑️  Lösche eventuell existierenden Test-User...');
    await queryAsync('DELETE FROM users WHERE email = ? OR username = ?', ['mitglied@test.de', 'testmitglied']);
    console.log('✅ Alte Daten gelöscht\n');

    // 2. Hash Passwort
    console.log('🔐 Hashe Passwort...');
    const password = 'test123';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('✅ Passwort gehasht\n');

    // 3. Erstelle User mit Rolle 'mitglied'
    console.log('👤 Erstelle User-Account mit Rolle "mitglied"...');
    const userResult = await queryAsync(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['testmitglied', 'mitglied@test.de', hashedPassword, 'mitglied']
    );
    const userId = userResult.insertId;
    console.log(`✅ User erstellt (ID: ${userId})\n`);

    // 4. Erstelle Mitgliederprofil mit Demo-Daten
    console.log('🥋 Erstelle Mitgliederprofil mit Demo-Daten...');
    
    // Hole das erste verfügbare Dojo
    const dojos = await queryAsync('SELECT id FROM dojo LIMIT 1');
    const dojoId = dojos.length > 0 ? dojos[0].id : 1;
    
    await queryAsync(
      `INSERT INTO mitglieder (
        dojo_id, vorname, nachname, email, telefon, telefon_mobil,
        geburtsdatum, geschlecht, strasse, hausnummer, plz, ort,
        iban, bic, bankname, kontoinhaber,
        allergien, medizinische_hinweise,
        notfallkontakt_name, notfallkontakt_telefon, notfallkontakt_verhaeltnis,
        hausordnung_akzeptiert, datenschutz_akzeptiert, foto_einverstaendnis,
        eintrittsdatum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dojoId,
        'Max',
        'Mustermann',
        'mitglied@test.de',
        '0711 123456',
        '0171 9876543',
        '1990-06-15',
        'm',
        'Musterstraße',
        '123',
        '70173',
        'Stuttgart',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'Commerzbank Stuttgart',
        'Max Mustermann',
        'Keine bekannt',
        'Keine',
        'Maria Mustermann',
        '0171 1234567',
        'Ehefrau',
        1,
        1,
        1,
        '2023-01-15'
      ]
    );
    const memberId = await queryAsync('SELECT LAST_INSERT_ID() as id');
    console.log(`✅ Mitgliederprofil erstellt (ID: ${memberId[0].id})\n`);

    // 5. Erstelle Demo-Beiträge (3 bezahlt, 1 offen) - wenn Tabelle existiert
    console.log('💰 Erstelle Demo-Beitragsdaten...');
    try {
      const heute = new Date();
      
      // Bezahlte Beiträge
      for (let i = 3; i > 0; i--) {
        const monat = new Date(heute);
        monat.setMonth(heute.getMonth() - i);
        const faellig = new Date(monat);
        faellig.setDate(15);
        const bezahlt = new Date(faellig);
        bezahlt.setDate(faellig.getDate() - 2);
        
        await queryAsync(
          `INSERT INTO beitraege (mitglied_id, betrag, faelligkeitsdatum, zahlungsdatum, typ, beschreibung)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            memberId[0].id,
            49.90,
            faellig.toISOString().split('T')[0],
            bezahlt.toISOString().split('T')[0],
            'monatsbeitrag',
            `Monatsbeitrag ${monat.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`
          ]
        );
      }
      
      // Offener Beitrag
      const naechsterMonat = new Date(heute);
      naechsterMonat.setMonth(heute.getMonth() + 1);
      naechsterMonat.setDate(15);
      
      await queryAsync(
        `INSERT INTO beitraege (mitglied_id, betrag, faelligkeitsdatum, typ, beschreibung)
         VALUES (?, ?, ?, ?, ?)`,
        [
          memberId[0].id,
          49.90,
          naechsterMonat.toISOString().split('T')[0],
          'monatsbeitrag',
          `Monatsbeitrag ${naechsterMonat.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`
        ]
      );
      console.log('✅ 4 Beitragseinträge erstellt (3 bezahlt, 1 offen)\n');
    } catch (error) {
      console.log('⚠️  Beiträge konnten nicht erstellt werden (Tabelle existiert eventuell nicht)\n');
    }

    // 7. Ausgabe Login-Daten
    console.log('═══════════════════════════════════════');
    console.log('✅ TEST-BENUTZER ERFOLGREICH ERSTELLT!');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('📋 LOGIN-DATEN:');
    console.log('   Username:  testmitglied');
    console.log('   Email:     mitglied@test.de');
    console.log('   Passwort:  test123');
    console.log('   Rolle:     mitglied');
    console.log('');
    console.log('💡 ENTHALTENE DEMO-DATEN:');
    console.log('   ✅ Vollständiges Mitgliederprofil');
    console.log('   ✅ 4 Beiträge (3 bezahlt, 1 offen) - falls möglich');
    console.log('');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Test-Benutzers:', error);
    process.exit(1);
  } finally {
    db.end();
    process.exit(0);
  }
};

createTestMember();

