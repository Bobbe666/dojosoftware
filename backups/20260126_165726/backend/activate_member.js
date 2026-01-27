const mysql = require('mysql2/promise');

async function activateMember() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'dojo'
  });

  try {
    console.log('🔄 Aktiviere Test-Mitglied...');
    
    // Aktiviere Tom Tester oder ähnliches Mitglied
    const [result] = await connection.execute(
      'UPDATE mitglieder SET aktiv = 1 WHERE (vorname LIKE "%Tom%" OR vorname LIKE "%tom%") AND (nachname LIKE "%Tester%" OR nachname LIKE "%tester%") OR email LIKE "%tom%"'
    );
    
    console.log('✅ Aktualisiert:', result.affectedRows, 'Mitglieder');
    
    // Prüfe das Ergebnis
    const [members] = await connection.execute(
      'SELECT mitglied_id, vorname, nachname, email, aktiv FROM mitglieder WHERE vorname LIKE "%Tom%" OR email LIKE "%tom%"'
    );
    
    console.log('📋 Gefundene Mitglieder:');
    members.forEach(member => {
      console.log(`   ID: ${member.mitglied_id}, Name: ${member.vorname} ${member.nachname}, Email: ${member.email}, Aktiv: ${member.aktiv ? '✅' : '❌'}`);
    });
    
    if (members.length === 0) {
      console.log('⚠️ Kein Tom-Tester Mitglied gefunden. Zeige alle Mitglieder:');
      const [allMembers] = await connection.execute(
        'SELECT mitglied_id, vorname, nachname, email, aktiv FROM mitglieder LIMIT 5'
      );
      allMembers.forEach(member => {
        console.log(`   ID: ${member.mitglied_id}, Name: ${member.vorname} ${member.nachname}, Email: ${member.email}, Aktiv: ${member.aktiv ? '✅' : '❌'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    await connection.end();
  }
}

activateMember();
