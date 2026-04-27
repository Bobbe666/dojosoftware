/**
 * Fix: Stripe Customer + PaymentMethod für Leonard Kern (mitglied_id 140)
 * Ruft createSepaCustomer auf um stripe_customer_id + stripe_payment_method_id zu setzen
 */
const db = require('../db');
const PaymentProviderFactory = require('../services/PaymentProviderFactory');

async function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
    });
}

async function run() {
    const MITGLIED_ID = 140;

    // Mitglied + SEPA laden
    const rows = await queryAsync(`
        SELECT m.mitglied_id, m.vorname, m.nachname, m.email, m.stripe_customer_id, m.dojo_id,
               sm.iban, sm.kontoinhaber, sm.stripe_payment_method_id
        FROM mitglieder m
        LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        WHERE m.mitglied_id = ?
    `, [MITGLIED_ID]);

    if (rows.length === 0) {
        console.error(`❌ Mitglied ${MITGLIED_ID} nicht gefunden`);
        process.exit(1);
    }

    const mitglied = rows[0];
    console.log(`👤 ${mitglied.vorname} ${mitglied.nachname} (ID ${mitglied.mitglied_id}, Dojo ${mitglied.dojo_id})`);
    console.log(`   IBAN: ${mitglied.iban}`);
    console.log(`   Kontoinhaber: ${mitglied.kontoinhaber}`);
    console.log(`   stripe_customer_id: ${mitglied.stripe_customer_id || '—'}`);
    console.log(`   stripe_payment_method_id: ${mitglied.stripe_payment_method_id || '—'}`);

    if (!mitglied.iban) {
        console.error('❌ Kein aktives SEPA-Mandat mit IBAN gefunden');
        process.exit(1);
    }

    const provider = await PaymentProviderFactory.getProvider(mitglied.dojo_id);
    console.log(`\n💳 Provider: ${provider.getProviderName()}`);

    if (!provider.createSepaCustomer) {
        console.error('❌ Provider unterstützt createSepaCustomer nicht');
        process.exit(1);
    }

    const result = await provider.createSepaCustomer(
        mitglied,
        mitglied.iban,
        mitglied.kontoinhaber || `${mitglied.vorname} ${mitglied.nachname}`
    );

    console.log(`\n✅ Stripe Setup erfolgreich:`);
    console.log(`   stripe_customer_id:       ${result.stripe_customer_id}`);
    console.log(`   stripe_payment_method_id: ${result.stripe_payment_method_id}`);

    process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
