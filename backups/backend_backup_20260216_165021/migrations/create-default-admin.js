// Script zum Erstellen des Standard-Admin-Benutzers
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojo'
});

async function createDefaultAdmin() {
  console.log('\n🔐 Erstelle Standard-Admin-Benutzer...\n');

  try {
    // Prüfen ob bereits ein Admin existiert
    const checkSql = 'SELECT COUNT(*) as count FROM admin_users';

    db.query(checkSql, async (err, results) => {
      if (err) {
        console.error('❌ Fehler beim Prüfen:', err.message);
        process.exit(1);
      }

      if (results[0].count > 0) {
        console.log('ℹ️  Es existieren bereits Admin-Benutzer.');
        console.log('   Standard-Admin wird nicht erstellt.');
        db.end();
        process.exit(0);
      }

      // Passwort hashen
      const defaultPassword = 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      // Standard-Berechtigungen für Super-Admin
      const berechtigungen = {
        mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        vertraege: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        finanzen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        einstellungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        admins: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        dashboard: { lesen: true },
        berichte: { lesen: true, exportieren: true }
      };

      const insertSql = `
        INSERT INTO admin_users (
          username,
          email,
          password,
          vorname,
          nachname,
          rolle,
          berechtigungen,
          aktiv,
          email_verifiziert
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        'admin',
        'admin@dojo.local',
        hashedPassword,
        'System',
        'Administrator',
        'super_admin',
        JSON.stringify(berechtigungen),
        1,
        1
      ];

      db.query(insertSql, values, (insertErr, result) => {
        if (insertErr) {
          console.error('❌ Fehler beim Erstellen des Admins:', insertErr.message);
          db.end();
          process.exit(1);
        }

        console.log('✅ Standard-Admin erfolgreich erstellt!\n');
        console.log('📋 Login-Daten:');
        console.log('   Username: admin');
        console.log('   Passwort: admin123');
        console.log('\n⚠️  WICHTIG: Bitte ändern Sie das Passwort nach dem ersten Login!\n');

        db.end();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Fehler:', error.message);
    db.end();
    process.exit(1);
  }
}

createDefaultAdmin();
