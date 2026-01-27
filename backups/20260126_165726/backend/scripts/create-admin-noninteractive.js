#!/usr/bin/env node

/**
 * Nicht-interaktives Admin-Erstellungs-Script
 * Verwendung: node create-admin-noninteractive.js <username> <email> <password>
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function createAdminUser() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.error('Verwendung: node create-admin-noninteractive.js <username> <email> <password>');
        process.exit(1);
    }

    const [username, email, password] = args;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   DOJOSOFTWARE - ADMIN-BENUTZER ERSTELLEN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'dojo'
        });

        console.log('✅ Datenbankverbindung hergestellt\n');

        // Prüfen ob Username/Email bereits existiert
        const [existingUser] = await connection.execute(
            'SELECT username, email FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            console.error('❌ Username oder Email bereits vergeben!');
            console.log('Existierender User:', existingUser[0]);
            await connection.end();
            process.exit(1);
        }

        // Passwort hashen
        console.log('🔐 Hashe Passwort...');
        const hashedPassword = await bcrypt.hash(password, 10);

        // User erstellen
        console.log('💾 Erstelle Admin-Benutzer...');
        const [result] = await connection.execute(
            `INSERT INTO users (username, email, password, role, mitglied_id)
             VALUES (?, ?, ?, 'admin', NULL)`,
            [username, email, hashedPassword]
        );

        console.log('\n✅ Admin-Benutzer erfolgreich erstellt!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Login-Daten:');
        console.log(`   ID:       ${result.insertId}`);
        console.log(`   Username: ${username}`);
        console.log(`   Email:    ${email}`);
        console.log(`   Password: ${password}`);
        console.log('   Role:     admin');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n⚠️  WICHTIG: Ändern Sie das Passwort nach dem ersten Login!\n');

        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Fehler:', error.message);
        process.exit(1);
    }
}

createAdminUser();
