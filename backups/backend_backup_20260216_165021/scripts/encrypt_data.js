const mysql = require('mysql2/promise');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string' || plaintext.startsWith('enc:')) {
        return plaintext;
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `enc:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

async function run() {
    console.log('🔐 Starte Verschlüsselung...');

    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'aaBobbe100aa$',
        database: 'dojo'
    });

    // Verschlüssele Dojo Keys
    console.log('\n📋 Verschlüssele Dojo-Credentials...');
    const [dojos] = await conn.query(`
        SELECT id, dojoname, stripe_secret_key, stripe_publishable_key,
               datev_api_key, paypal_client_secret, sumup_api_key,
               sumup_client_secret, lexoffice_api_key
        FROM dojo
    `);

    for (const dojo of dojos) {
        const updates = [];
        const values = [];

        const fields = [
            'stripe_secret_key', 'stripe_publishable_key', 'datev_api_key',
            'paypal_client_secret', 'sumup_api_key', 'sumup_client_secret', 'lexoffice_api_key'
        ];

        for (const field of fields) {
            if (dojo[field] && !dojo[field].startsWith('enc:')) {
                updates.push(`${field} = ?`);
                values.push(encrypt(dojo[field]));
            }
        }

        if (updates.length > 0) {
            values.push(dojo.id);
            await conn.query(`UPDATE dojo SET ${updates.join(', ')} WHERE id = ?`, values);
            console.log(`   ✅ ${dojo.dojoname}`);
        }
    }

    // Verschlüssele Connect Tokens
    console.log('\n📋 Verschlüssele Stripe Connect Tokens...');
    const [accounts] = await conn.query('SELECT id, dojo_id, access_token, refresh_token FROM stripe_connect_accounts');

    for (const acc of accounts) {
        const updates = [];
        const values = [];

        if (acc.access_token && !acc.access_token.startsWith('enc:')) {
            updates.push('access_token = ?');
            values.push(encrypt(acc.access_token));
        }
        if (acc.refresh_token && !acc.refresh_token.startsWith('enc:')) {
            updates.push('refresh_token = ?');
            values.push(encrypt(acc.refresh_token));
        }

        if (updates.length > 0) {
            values.push(acc.id);
            await conn.query(`UPDATE stripe_connect_accounts SET ${updates.join(', ')} WHERE id = ?`, values);
            console.log(`   ✅ Connect Account Dojo ${acc.dojo_id}`);
        }
    }

    await conn.end();
    console.log('\n✅ Verschlüsselung abgeschlossen!');
    console.log('\n⚠️  WICHTIG: Sichere den ENCRYPTION_KEY!');
}

run().catch(err => {
    console.error('❌ Fehler:', err);
    process.exit(1);
});
