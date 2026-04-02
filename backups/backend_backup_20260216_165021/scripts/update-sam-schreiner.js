#!/usr/bin/env node

/**
 * Update Sam Schreiner Login
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function updateSamSchreiner() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   UPDATE SAM SCHREINER LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const newUsername = 'Sam Schreiner';
    const newPassword = 'aaSamaa2026';

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'dojo'
        });

        console.log('✅ Datenbankverbindung hergestellt\n');

        // Passwort hashen
        console.log('🔐 Hashe neues Passwort...');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // User aktualisieren
        console.log('💾 Aktualisiere Login-Daten...');
        const [result] = await connection.execute(
            `UPDATE users
             SET username = ?, password = ?
             WHERE mitglied_id = 1`,
            [newUsername, hashedPassword]
        );

        if (result.affectedRows === 0) {
            console.error('❌ Kein User mit mitglied_id = 1 gefunden!');
            await connection.end();
            process.exit(1);
        }

        console.log('\n✅ Login-Daten erfolgreich aktualisiert!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Neue Login-Daten:');
        console.log(`   Username: ${newUsername}`);
        console.log(`   Email:    headquarter@tda-intl.com`);
        console.log(`   Password: ${newPassword}`);
        console.log('   Role:     member');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Fehler:', error.message);
        process.exit(1);
    }
}

updateSamSchreiner();
