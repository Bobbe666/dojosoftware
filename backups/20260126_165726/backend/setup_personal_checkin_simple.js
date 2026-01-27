// Personal Check-in System Setup
const db = require('./db');

console.log('📋 Setting up Personal Check-in System...');

// SQL-Befehle einzeln ausführen
const commands = [
  {
    name: 'Add Stundenlohn field to Personal table',
    sql: `ALTER TABLE personal ADD COLUMN stundenlohn DECIMAL(10,2) DEFAULT NULL COMMENT 'Stundenlohn in Euro pro Stunde'`
  },
  {
    name: 'Create Personal Check-in table',
    sql: `CREATE TABLE IF NOT EXISTS personal_checkin (
      checkin_id INT PRIMARY KEY AUTO_INCREMENT,
      personal_id INT NOT NULL,
      checkin_time DATETIME NOT NULL,
      checkout_time DATETIME NULL,
      arbeitszeit_minuten INT NULL COMMENT 'Berechnete Arbeitszeit in Minuten',
      kosten DECIMAL(10,2) NULL COMMENT 'Berechnete Kosten basierend auf Stundenlohn',
      bemerkung TEXT NULL,
      status ENUM('eingecheckt', 'ausgecheckt') DEFAULT 'eingecheckt',
      erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (personal_id) REFERENCES personal(personal_id) ON DELETE CASCADE,
      
      INDEX idx_personal_datum (personal_id, checkin_time),
      INDEX idx_status (status),
      INDEX idx_checkin_time (checkin_time)
    ) ENGINE=InnoDB COMMENT='Personal Check-in/Check-out System'`
  },
  {
    name: 'Update Personal with example hourly rates',
    sql: `UPDATE personal SET stundenlohn = CASE 
      WHEN position LIKE '%Leiter%' OR position LIKE '%Manager%' THEN 25.00
      WHEN position LIKE '%Trainer%' THEN 18.50
      WHEN position LIKE '%Rezeption%' OR position LIKE '%Empfang%' THEN 15.00
      WHEN position LIKE '%Reinigung%' THEN 12.50
      ELSE 16.00
    END WHERE stundenlohn IS NULL`
  }
];

let completed = 0;

function executeCommand(index) {
  if (index >= commands.length) {
    console.log(`\n✅ Alle ${completed} Befehle erfolgreich ausgeführt!`);
    
    // Tabellenstruktur anzeigen
    db.query('DESCRIBE personal', (err, personalStructure) => {
      if (!err) {
        console.log('\n📋 Personal Tabelle (mit Stundenlohn):');
        console.table(personalStructure.filter(col => ['personal_id', 'vorname', 'nachname', 'position', 'stundenlohn'].includes(col.Field)));
      }
      
      db.query('DESCRIBE personal_checkin', (err, checkinStructure) => {
        if (!err) {
          console.log('\n📋 Personal Check-in Tabelle:');
          console.table(checkinStructure);
        }
        
        db.query('SELECT personal_id, vorname, nachname, position, stundenlohn FROM personal', (err, personalData) => {
          if (!err) {
            console.log('\n👥 Personal mit Stundenlöhnen:');
            console.table(personalData.map(p => ({
              ID: p.personal_id,
              Name: `${p.vorname} ${p.nachname}`,
              Position: p.position,
              Stundenlohn: `€${p.stundenlohn || '0.00'}`
            })));
          }
          
          console.log('\n🎉 Personal Check-in System erfolgreich eingerichtet!');
          process.exit(0);
        });
      });
    });
    return;
  }
  
  const command = commands[index];
  console.log(`🔄 ${index + 1}/${commands.length}: ${command.name}...`);
  
  db.query(command.sql, (error, results) => {
    if (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_COLUMN_NAME') {
        console.log(`⚠️  ${command.name} - Bereits vorhanden, überspringe...`);
        completed++;
      } else {
        console.error(`❌ Fehler bei: ${command.name}`, error.message);
        return;
      }
    } else {
      console.log(`✅ ${command.name} - Erfolgreich!`);
      completed++;
    }
    
    // Nächster Befehl
    executeCommand(index + 1);
  });
}

// Start execution
executeCommand(0);