const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;

  try {
    console.log('🔄 Starte Migration 029 (LOKAL): Subscription System...\n');

    // Verbindung zur Datenbank herstellen
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'aaBobbe100aa',
      database: process.env.DB_NAME || 'dojo',
      multipleStatements: true
    });

    console.log('✅ Mit Datenbank verbunden\n');

    // SQL-Datei lesen
    const migrationPath = path.join(__dirname, '../migrations/029_add_subscription_system_LOCAL.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('📄 Migration-Datei geladen:', migrationPath);
    console.log('📝 SQL-Länge:', sql.length, 'Zeichen\n');

    // Migration ausführen
    console.log('⚙️  Führe Migration aus...\n');
    await connection.query(sql);

    console.log('✅ Migration erfolgreich ausgeführt!\n');

    // Prüfe erstellte Tabellen
    const [tables] = await connection.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name IN ('dojo_subscriptions', 'subscription_plans', 'subscription_audit_log')
    `);

    console.log('📊 Erstellte Tabellen:');
    tables.forEach(t => {
      console.log('  ✓', t.table_name || t.TABLE_NAME);
    });

    // Prüfe Standard-Pläne
    const [plans] = await connection.query('SELECT plan_name, display_name, price_monthly FROM subscription_plans ORDER BY sort_order');
    console.log('\n💰 Standard-Pläne:');
    plans.forEach(p => {
      console.log(`  ✓ ${p.display_name} (${p.plan_name}): €${p.price_monthly}/Monat`);
    });

    // Prüfe Subscription für bestehendes Dojo
    const [subs] = await connection.query('SELECT dojo_id, subdomain, plan_type, status FROM dojo_subscriptions');
    console.log('\n🏢 Dojo Subscriptions:');
    if (subs.length === 0) {
      console.log('  ℹ️  Keine Subscriptions (Dojo wird bei Registrierung erstellt)');
    } else {
      subs.forEach(s => {
        console.log(`  ✓ Dojo ${s.dojo_id}: ${s.subdomain} (${s.plan_type}, ${s.status})`);
      });
    }

    console.log('\n✅ Migration 029 (LOKAL) erfolgreich abgeschlossen!');

  } catch (error) {
    console.error('\n❌ Migration fehlgeschlagen:', error.message);
    if (error.sql) {
      console.error('\n📄 Fehlgeschlagene SQL-Query:');
      console.error(error.sql.substring(0, 500) + '...');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Migration ausführen
runMigration();
