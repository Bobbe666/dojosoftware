const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function createMissingTables() {
  let connection;
  
  try {
    // Verbindung zur Datenbank
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "dojouser",
      password: process.env.DB_PASSWORD || "DojoServer2025!",
      database: process.env.DB_NAME || "dojo"
    });

    console.log('✅ Verbunden mit der MySQL-Datenbank');

    // SQL-Script lesen
    const sqlScript = fs.readFileSync('./create_missing_tables.sql', 'utf8');
    
    // Script in einzelne Statements aufteilen
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Erstelle ${statements.length} Tabellen...`);

    // Statements ausführen
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        await connection.execute(statement);
        console.log(`✅ Tabelle ${i + 1}/${statements.length} erfolgreich erstellt`);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  Tabelle ${i + 1}/${statements.length} bereits vorhanden`);
        } else {
          console.error(`❌ Fehler bei Tabelle ${i + 1}/${statements.length}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Alle Tabellen erfolgreich erstellt!');
    
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Tabellen:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Datenbankverbindung geschlossen');
    }
  }
}

// Script ausführen
createMissingTables();
