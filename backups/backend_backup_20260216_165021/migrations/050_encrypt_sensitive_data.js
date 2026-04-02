/**
 * Migration: Verschlüsselt alle sensiblen Daten in der Datenbank
 *
 * Betrifft:
 * - dojo.stripe_secret_key
 * - dojo.stripe_publishable_key
 * - dojo.datev_api_key
 * - dojo.paypal_client_secret
 * - dojo.sumup_api_key
 * - dojo.sumup_client_secret
 * - dojo.lexoffice_api_key
 * - stripe_connect_accounts.access_token
 * - stripe_connect_accounts.refresh_token
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');

// Encryption Config
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

// Datenbank-Konfiguration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'aaBobbe100aa$',
    database: process.env.DB_NAME || 'dojo'
};

function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY muss gesetzt sein!');
    }

    if (key.length === 64) {
        return Buffer.from(key, 'hex');
    } else if (key.length === 44) {
        return Buffer.from(key, 'base64');
    } else {
        return crypto.createHash('sha256').update(key).digest();
    }
}

function encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string' || plaintext.startsWith('enc:')) {
        return plaintext;
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return `enc:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

async function run() {
    console.log('🔐 Starte Verschlüsselung sensibler Daten...\n');

    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. Dojo-Tabelle: Stripe, PayPal, SumUp, LexOffice, DATEV Keys verschlüsseln
        console.log('📋 Verschlüssele Dojo-Credentials...');

        const [dojos] = await connection.query(`
            SELECT id, dojoname,
                   stripe_secret_key, stripe_publishable_key,
                   datev_api_key, paypal_client_secret,
                   sumup_api_key, sumup_client_secret, lexoffice_api_key
            FROM dojo
        `);

        let dojoCount = 0;
        for (const dojo of dojos) {
            const updates = {};
            let hasUpdates = false;

            // Prüfe und verschlüssele jeden Key
            const fieldsToEncrypt = [
                'stripe_secret_key',
                'stripe_publishable_key',
                'datev_api_key',
                'paypal_client_secret',
                'sumup_api_key',
                'sumup_client_secret',
                'lexoffice_api_key'
            ];

            for (const field of fieldsToEncrypt) {
                const value = dojo[field];
                if (value && !value.startsWith('enc:')) {
                    updates[field] = encrypt(value);
                    hasUpdates = true;
                }
            }

            if (hasUpdates) {
                const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                const values = [...Object.values(updates), dojo.id];

                await connection.query(
                    `UPDATE dojo SET ${setClauses} WHERE id = ?`,
                    values
                );
                dojoCount++;
                console.log(`   ✅ ${dojo.dojoname} (ID: ${dojo.id})`);
            }
        }
        console.log(`   → ${dojoCount} Dojos verschlüsselt\n`);

        // 2. Stripe Connect Accounts: Access & Refresh Tokens verschlüsseln
        console.log('📋 Verschlüssele Stripe Connect Tokens...');

        const [connectAccounts] = await connection.query(`
            SELECT id, dojo_id, access_token, refresh_token
            FROM stripe_connect_accounts
        `);

        let connectCount = 0;
        for (const account of connectAccounts) {
            const updates = {};
            let hasUpdates = false;

            if (account.access_token && !account.access_token.startsWith('enc:')) {
                updates.access_token = encrypt(account.access_token);
                hasUpdates = true;
            }

            if (account.refresh_token && !account.refresh_token.startsWith('enc:')) {
                updates.refresh_token = encrypt(account.refresh_token);
                hasUpdates = true;
            }

            if (hasUpdates) {
                const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                const values = [...Object.values(updates), account.id];

                await connection.query(
                    `UPDATE stripe_connect_accounts SET ${setClauses} WHERE id = ?`,
                    values
                );
                connectCount++;
                console.log(`   ✅ Connect Account für Dojo ${account.dojo_id}`);
            }
        }
        console.log(`   → ${connectCount} Connect Accounts verschlüsselt\n`);

        console.log('✅ Verschlüsselung abgeschlossen!');
        console.log('\n⚠️  WICHTIG: Sichere den ENCRYPTION_KEY - ohne ihn sind die Daten nicht mehr lesbar!');

    } catch (error) {
        console.error('❌ Fehler bei der Verschlüsselung:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Führe Migration aus wenn direkt aufgerufen
if (require.main === module) {
    run()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { run };
