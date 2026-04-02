// Script zum Einfügen von Test-Bankdaten
const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "dojo",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

async function seedTestBanken() {
  try {
    console.log('🔄 Starte Test-Bankdaten Import...');

    // Hole erstes Dojo aus der Datenbank
    const dojos = await queryAsync('SELECT id FROM dojo LIMIT 1');
    
    if (dojos.length === 0) {
      console.log('❌ Kein Dojo gefunden. Bitte erst ein Dojo anlegen.');
      process.exit(1);
    }

    const dojoId = dojos[0].id;
    console.log(`✅ Verwende Dojo ID: ${dojoId}`);

    // Lösche existierende Banken für dieses Dojo
    await queryAsync('DELETE FROM dojo_banken WHERE dojo_id = ?', [dojoId]);
    console.log('🗑️  Alte Bankdaten gelöscht');

    // Test-Banken
    const testBanken = [
      // 1. Hauptkonto - Sparkasse (Standard)
      {
        dojo_id: dojoId,
        bank_name: 'Sparkasse Stuttgart',
        bank_typ: 'bank',
        ist_aktiv: true,
        ist_standard: true,
        iban: 'DE89370400440532013000',
        bic: 'COBADEFFXXX',
        kontoinhaber: 'Tiger & Dragon Dojo e.V.',
        sepa_glaeubiger_id: 'DE98ZZZ09999999999',
        notizen: 'Hauptgeschäftskonto für laufende Beiträge und Ausgaben',
        sortierung: 0
      },
      
      // 2. Zweites Bankkonto
      {
        dojo_id: dojoId,
        bank_name: 'Volksbank Stuttgart',
        bank_typ: 'bank',
        ist_aktiv: true,
        ist_standard: false,
        iban: 'DE89370400440532099988',
        bic: 'VOBADESS',
        kontoinhaber: 'Tiger & Dragon Dojo e.V.',
        sepa_glaeubiger_id: null,
        notizen: 'Rücklagenkonto für größere Investitionen',
        sortierung: 1
      },

      // 3. Stripe
      {
        dojo_id: dojoId,
        bank_name: 'Stripe',
        bank_typ: 'stripe',
        ist_aktiv: true,
        ist_standard: false,
        stripe_publishable_key: 'pk_test_51JxYZ0123456789abcdefghijklmnopqrstuvwxyz',
        stripe_secret_key: 'sk_test_51JxYZ9876543210zyxwvutsrqponmlkjihgfedcba',
        stripe_account_id: 'acct_1234567890ABCDEF',
        notizen: 'Online-Zahlungen für Kursbuchungen und Shop',
        sortierung: 2
      },

      // 4. PayPal
      {
        dojo_id: dojoId,
        bank_name: 'PayPal Business',
        bank_typ: 'paypal',
        ist_aktiv: true,
        ist_standard: false,
        paypal_email: 'business@tigerdragondojo.de',
        // ACHTUNG: Dies sind FAKE Test-Credentials - NICHT für Production verwenden!
        paypal_client_id: 'TEST_CLIENT_ID_NICHT_VERWENDEN',
        paypal_client_secret: 'TEST_SECRET_NICHT_VERWENDEN',
        notizen: 'Alternative Online-Zahlungsmethode für internationale Mitglieder',
        sortierung: 3
      },

      // 5. Postbank - Inaktiv
      {
        dojo_id: dojoId,
        bank_name: 'Postbank',
        bank_typ: 'bank',
        ist_aktiv: false,
        ist_standard: false,
        iban: 'DE10370100500987654321',
        bic: 'PBNKDEFF',
        kontoinhaber: 'Tiger & Dragon Dojo e.V.',
        sepa_glaeubiger_id: null,
        notizen: 'Altes Konto - wird nicht mehr verwendet',
        sortierung: 4
      },

      // 6. Commerzbank - Events
      {
        dojo_id: dojoId,
        bank_name: 'Commerzbank Events',
        bank_typ: 'bank',
        ist_aktiv: true,
        ist_standard: false,
        iban: 'DE88100400000123456789',
        bic: 'COBADEFFXXX',
        kontoinhaber: 'Tiger & Dragon Dojo e.V.',
        sepa_glaeubiger_id: null,
        notizen: 'Spezialkonto für Turniere und Veranstaltungen',
        sortierung: 5
      }
    ];

    // Banken einfügen
    for (const bank of testBanken) {
      await queryAsync(`
        INSERT INTO dojo_banken (
          dojo_id, bank_name, bank_typ, ist_aktiv, ist_standard,
          iban, bic, kontoinhaber, sepa_glaeubiger_id,
          stripe_publishable_key, stripe_secret_key, stripe_account_id,
          paypal_email, paypal_client_id, paypal_client_secret,
          notizen, sortierung
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bank.dojo_id,
        bank.bank_name,
        bank.bank_typ,
        bank.ist_aktiv,
        bank.ist_standard,
        bank.iban || null,
        bank.bic || null,
        bank.kontoinhaber || null,
        bank.sepa_glaeubiger_id || null,
        bank.stripe_publishable_key || null,
        bank.stripe_secret_key || null,
        bank.stripe_account_id || null,
        bank.paypal_email || null,
        bank.paypal_client_id || null,
        bank.paypal_client_secret || null,
        bank.notizen || null,
        bank.sortierung
      ]);
      
      console.log(`✅ ${bank.bank_name} (${bank.bank_typ}) hinzugefügt`);
    }

    console.log('\n🎉 Test-Bankdaten erfolgreich importiert!');
    console.log(`📊 ${testBanken.length} Banken für Dojo ID ${dojoId} angelegt:`);
    console.log('   - Sparkasse Stuttgart (Standard, Aktiv)');
    console.log('   - Volksbank Stuttgart (Aktiv)');
    console.log('   - Stripe (Aktiv)');
    console.log('   - PayPal Business (Aktiv)');
    console.log('   - Postbank (Inaktiv)');
    console.log('   - Commerzbank Events (Aktiv)');
    console.log('\n💡 Öffne jetzt das Dojo im Frontend und gehe zum "Bank" Tab!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fehler beim Importieren der Test-Bankdaten:', error);
    process.exit(1);
  }
}

// Script ausführen
seedTestBanken();

