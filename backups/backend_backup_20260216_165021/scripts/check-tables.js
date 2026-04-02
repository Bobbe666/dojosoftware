const mysql = require('mysql2');
require('dotenv').config();

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojosoftware'
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

console.log('🔍 Checking database tables...');

// Prüfe alle Tabellen
db.query('SHOW TABLES', (err, results) => {
  if (err) {
    console.error('❌ Error checking tables:', err);
    return;
  }
  
  console.log('\n📊 Available tables:');
  results.forEach(row => {
    const tableName = Object.values(row)[0];
    console.log(`  - ${tableName}`);
  });
  
  // Prüfe mitglieder Tabelle
  console.log('\n👥 Checking mitglieder table...');
  db.query('SELECT COUNT(*) as count FROM mitglieder', (err, results) => {
    if (err) {
      console.log('❌ Mitglider table error:', err.message);
    } else {
      console.log(`✅ Mitglider table: ${results[0].count} records`);
      
      // Prüfe Emails in mitglieder
      db.query('SELECT COUNT(*) as count FROM mitglieder WHERE email IS NOT NULL AND email != ""', (err, emailResults) => {
        if (err) {
          console.log('❌ Email check error:', err.message);
        } else {
          console.log(`📧 Members with email: ${emailResults[0].count}`);
        }
      });
    }
  });
  
  // Prüfe trainer Tabelle
  console.log('\n👨‍🏫 Checking trainer table...');
  db.query('SELECT COUNT(*) as count FROM trainer', (err, results) => {
    if (err) {
      console.log('❌ Trainer table error:', err.message);
    } else {
      console.log(`✅ Trainer table: ${results[0].count} records`);
      
      // Prüfe Emails in trainer
      db.query('SELECT COUNT(*) as count FROM trainer WHERE email IS NOT NULL AND email != ""', (err, emailResults) => {
        if (err) {
          console.log('❌ Email check error:', err.message);
        } else {
          console.log(`📧 Trainers with email: ${emailResults[0].count}`);
        }
      });
    }
  });
  
  // Prüfe personal Tabelle
  console.log('\n🧑‍💼 Checking personal table...');
  db.query('SELECT COUNT(*) as count FROM personal', (err, results) => {
    if (err) {
      console.log('❌ Personal table error:', err.message);
    } else {
      console.log(`✅ Personal table: ${results[0].count} records`);
      
      // Prüfe Emails in personal
      db.query('SELECT COUNT(*) as count FROM personal WHERE email IS NOT NULL AND email != ""', (err, emailResults) => {
        if (err) {
          console.log('❌ Email check error:', err.message);
        } else {
          console.log(`📧 Personal with email: ${emailResults[0].count}`);
        }
        
        // Beende die Verbindung
        db.end();
      });
    }
  });
});






























