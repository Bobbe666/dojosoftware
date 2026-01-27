// Check vertrag data in database
const db = require('./db');

async function checkVertrag() {
    const query = `
        SELECT
            v.id,
            v.mitglied_id,
            v.status,
            v.tarif_id,
            v.monatsbeitrag,
            v.billing_cycle,
            v.vertragsbeginn,
            v.vertragsende,
            v.kuendigung_eingegangen,
            v.kuendigungsgrund,
            t.name as tarif_name
        FROM vertraege v
        LEFT JOIN tarife t ON v.tarif_id = t.id
        WHERE v.id IN (15, 16, 17)
        ORDER BY v.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error:', err);
            process.exit(1);
        }

        console.log('\n📊 Verträge in Datenbank:\n');
        results.forEach(v => {
            console.log(`Vertrag ID ${v.id}:`);
            console.log(`  - Status: ${v.status}`);
            console.log(`  - Tarif ID: ${v.tarif_id}`);
            console.log(`  - Tarif Name: ${v.tarif_name}`);
            console.log(`  - Monatsbeitrag: ${v.monatsbeitrag}`);
            console.log(`  - Billing Cycle: ${v.billing_cycle}`);
            console.log(`  - Vertragsbeginn: ${v.vertragsbeginn}`);
            console.log(`  - Vertragsende: ${v.vertragsende}`);
            console.log(`  - Kündigung: ${v.kuendigung_eingegangen}`);
            console.log(`  - Kündigungsgrund: ${v.kuendigungsgrund}`);
            console.log('');
        });

        process.exit(0);
    });
}

checkVertrag();
