// Personal Check-in Tabelle und Stundenlohn hinzufügen
const db = require('./db');
const fs = require('fs');

console.log('📋 Personal Check-in System wird eingerichtet...');

const sqlScript = fs.readFileSync('./add_stundenlohn_and_checkin.sql', 'utf8');

// SQL-Befehle einzeln ausführen
const sqlCommands = sqlScript.split(';').filter(cmd => cmd.trim().length > 0);

async function executeCommands() {
  for (let i = 0; i < sqlCommands.length; i++) {
    const command = sqlCommands[i].trim();
    if (command && !command.startsWith('--')) {
      try {
        console.log(`🔄 Führe Befehl ${i + 1}/${sqlCommands.length} aus...`);
        const results = await db.query(command);
        console.log(`✅ Befehl ${i + 1} erfolgreich ausgeführt`);
      } catch (error) {
        console.error(`❌ Fehler bei Befehl ${i + 1}:`, error.message);
        if (error.code !== 'ER_DUP_FIELDNAME') { // Ignoriere "Feld existiert bereits" Fehler
          throw error;
        }
      }
    }
  }
  
  // Überprüfung der neuen Strukturen
  try {
    console.log('\n📋 Überprüfe Personal Tabellen-Struktur...');
    const personalStructure = await db.query('DESCRIBE personal');
    console.table(personalStructure);
    
    console.log('\n📋 Überprüfe Personal Check-in Tabellen-Struktur...');
    const checkinStructure = await db.query('DESCRIBE personal_checkin');
    console.table(checkinStructure);
    
    console.log('\n👥 Personal mit Stundenlohn:');
    const personalData = await db.query('SELECT personal_id, vorname, nachname, position, stundenlohn FROM personal');
    console.table(personalData.map(p => ({
      ID: p.personal_id,
      Name: `${p.vorname} ${p.nachname}`,
      Position: p.position,
      Stundenlohn: `€${p.stundenlohn || '0.00'}`
    })));
    
    console.log('\n⏰ Personal Check-ins:');
    const checkinData = await db.query('SELECT * FROM personal_checkin');
    console.table(checkinData);
    
    console.log('\n✅ Personal Check-in System erfolgreich eingerichtet!');
    
  } catch (error) {
    console.error('❌ Fehler bei der Überprüfung:', error);
  } finally {
    process.exit(0);
  }
}

executeCommands().catch(error => {
  console.error('❌ Fehler beim Setup:', error);
  process.exit(1);
});;