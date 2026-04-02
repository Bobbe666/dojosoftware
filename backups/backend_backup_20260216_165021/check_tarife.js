// Check tarife table
const db = require('./db');

async function checkTarife() {
    const query = `
        SELECT *
        FROM tarife
        WHERE id = 24
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error:', err);
            process.exit(1);
        }

        console.log('\n📊 Tarif in Datenbank:\n');
        results.forEach(t => {
            console.log(JSON.stringify(t, null, 2));
        });

        process.exit(0);
    });
}

checkTarife();
