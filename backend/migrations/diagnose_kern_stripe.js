/**
 * Diagnose: Warum schlägt Stripe Charge für Kern (mitglied_id 140) fehl?
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

    const rows = await queryAsync(`
        SELECT m.mitglied_id, m.vorname, m.nachname, m.email, m.stripe_customer_id, m.dojo_id,
               sm.iban, sm.kontoinhaber, sm.stripe_payment_method_id
        FROM mitglieder m
        LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        WHERE m.mitglied_id = ?
    `, [MITGLIED_ID]);

    const mitglied = rows[0];
    console.log(`👤 ${mitglied.vorname} ${mitglied.nachname} (ID ${mitglied.mitglied_id}, Dojo ${mitglied.dojo_id})`);
    console.log(`   stripe_customer_id:       ${mitglied.stripe_customer_id}`);
    console.log(`   stripe_payment_method_id: ${mitglied.stripe_payment_method_id}`);

    const provider = await PaymentProviderFactory.getProvider(mitglied.dojo_id);
    console.log(`\n💳 Provider: ${provider.getProviderName()}`);
    console.log(`   stripe key present: ${!!provider.stripe}`);

    // Prüfe Customer auf Stripe
    try {
        const customer = await provider.stripe.customers.retrieve(mitglied.stripe_customer_id);
        console.log(`\n✅ Customer existiert: ${customer.id} (${customer.deleted ? '⚠️ DELETED' : 'aktiv'})`);
    } catch (e) {
        console.log(`\n❌ Customer Fehler: ${e.type} / ${e.code} / ${e.statusCode}: ${e.message}`);
    }

    // Prüfe PaymentMethod auf Stripe
    try {
        const pm = await provider.stripe.paymentMethods.retrieve(mitglied.stripe_payment_method_id);
        console.log(`✅ PaymentMethod existiert: ${pm.id} (type: ${pm.type}, customer: ${pm.customer})`);
        if (pm.sepa_debit) {
            console.log(`   IBAN last4: ${pm.sepa_debit.last4}, Bank: ${pm.sepa_debit.bank_code || 'n/a'}`);
        }
    } catch (e) {
        console.log(`❌ PaymentMethod Fehler: ${e.type} / ${e.code} / ${e.statusCode}: ${e.message}`);
    }

    // Teste PaymentIntent-Erstellung mit exaktem gleichen Params
    console.log(`\n🔄 Teste PaymentIntent-Erstellung...`);
    try {
        const pi = await provider.stripe.paymentIntents.create({
            amount: 4999,
            currency: 'eur',
            customer: mitglied.stripe_customer_id,
            payment_method: mitglied.stripe_payment_method_id,
            payment_method_types: ['sepa_debit'],
            confirm: true,
            off_session: true,
            mandate_data: {
                customer_acceptance: {
                    type: 'offline'
                }
            },
            description: 'TEST Mitgliedsbeitrag 5/2026',
            metadata: { mitglied_id: String(MITGLIED_ID), test: 'true' }
        });
        console.log(`✅ PaymentIntent erstellt: ${pi.id} (status: ${pi.status})`);
        // Sofort stornieren damit kein echter Einzug passiert
        await provider.stripe.paymentIntents.cancel(pi.id);
        console.log(`↩️  PaymentIntent ${pi.id} storniert`);
    } catch (e) {
        console.log(`❌ PaymentIntent Fehler:`);
        console.log(`   type:        ${e.type}`);
        console.log(`   code:        ${e.code}`);
        console.log(`   param:       ${e.param}`);
        console.log(`   statusCode:  ${e.statusCode}`);
        console.log(`   message:     ${e.message}`);
        console.log(`   raw.message: ${e.raw?.message}`);
        console.log(`   raw.code:    ${e.raw?.code}`);
        console.log(`   raw.type:    ${e.raw?.type}`);
    }

    process.exit(0);
}

run().catch(e => { console.error('❌ Script Fehler:', e.message); process.exit(1); });
