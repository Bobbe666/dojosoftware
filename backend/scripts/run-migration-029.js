const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojo',
  multipleStatements: true
});

console.log('🔄 Starte Migration 029: Subscription System...\n');

const migrationPath = path.join(__dirname, '..', 'migrations', '029_add_subscription_system.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

db.connect((err) => {
  if (err) {
    console.error('❌ Datenbankverbindung fehlgeschlagen:', err);
    process.exit(1);
  }

  console.log('✅ Mit Datenbank verbunden\n');

  db.query(sql, (error, results) => {
    if (error) {
      console.error('❌ Migration fehlgeschlagen:', error);
      db.end();
      process.exit(1);
    }

    console.log('✅ Migration 029 erfolgreich ausgeführt!\n');
    console.log('📋 Änderungen:');
    console.log('   - dojos Tabelle erweitert (subdomain, onboarding_completed, registration_date)');
    console.log('   - dojo_subscriptions Tabelle erstellt');
    console.log('   - subscription_plans Tabelle erstellt (mit Standard-Plänen)');
    console.log('   - subscription_audit_log Tabelle erstellt');
    console.log('   - admins Tabelle erweitert (role, email_verified, verification_token)');
    console.log('   - Bestehendes Dojo auf Premium-Plan gesetzt\n');

    // Zeige erstellte Pläne
    db.query('SELECT plan_name, display_name, price_monthly, max_members FROM subscription_plans ORDER BY sort_order', (err, plans) => {
      if (!err && plans.length > 0) {
        console.log('📦 Verfügbare Pläne:');
        plans.forEach(plan => {
          console.log(`   - ${plan.display_name}: €${plan.price_monthly}/Monat (bis ${plan.max_members} Mitglieder)`);
        });
      }

      db.end();
      console.log('\n✅ Migration abgeschlossen!');
      process.exit(0);
    });
  });
});
